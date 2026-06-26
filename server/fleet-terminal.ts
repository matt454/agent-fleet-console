import crypto from "node:crypto";
import { validators } from "./config.ts";
import { upgradeAuthorized } from "./auth.ts";
import { fleetProxyNode, remoteFetch } from "./services/fleet-nodes.ts";
import { validateTerminalTicket } from "./services/terminal-tickets.ts";

function parseWebSocketFrames(buffer: Buffer, onText: (text: string) => void, onClose: () => void) {
  let offset = 0;
  while (buffer.length - offset >= 2) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    let length = second & 0x7f;
    let headerLength = 2;
    if (length === 126) {
      if (buffer.length - offset < 4) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (buffer.length - offset < 10) break;
      length = buffer.readUInt32BE(offset + 2) * 2 ** 32 + buffer.readUInt32BE(offset + 6);
      headerLength = 10;
    }
    const masked = Boolean(second & 0x80);
    const maskLength = masked ? 4 : 0;
    const frameLength = headerLength + maskLength + length;
    if (buffer.length - offset < frameLength) break;
    if (opcode === 0x8) onClose();
    if (opcode === 0x1) {
      const mask = masked ? buffer.subarray(offset + headerLength, offset + headerLength + 4) : null;
      const start = offset + headerLength + maskLength;
      const payload = Buffer.from(buffer.subarray(start, start + length));
      if (mask) for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
      onText(payload.toString("utf8"));
    }
    offset += frameLength;
  }
  return buffer.subarray(offset);
}

function webSocketSend(socket: any, payload: any) {
  if (socket.destroyed) return;
  const body = Buffer.from(JSON.stringify(payload));
  let header;
  if (body.length < 126) {
    header = Buffer.from([0x81, body.length]);
  } else if (body.length < 65536) {
    header = Buffer.from([0x81, 126, body.length >> 8, body.length & 0xff]);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(body.length, 6);
  }
  socket.write(Buffer.concat([header, body]));
}

function webSocketClose(socket: any) {
  if (!socket.destroyed) socket.end(Buffer.from([0x88, 0x00]));
}

export function createFleetTerminalUpgradeHandler() {
  return async function handleFleetTerminalUpgrade(req: any, socket: any) {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const match = url.pathname.match(/^\/api\/fleet\/([^/]+)\/instances\/([^/]+)\/terminal$/);
    if (!match) return false;
    try {
      const nodeId = decodeURIComponent(match[1]);
      const name = validators.validateName(decodeURIComponent(match[2]));
      if (nodeId === "local") return false;
      if (!upgradeAuthorized(req, url)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return true;
      }
      if (!validateTerminalTicket(`${nodeId}:${name}`, url.searchParams.get("ticket") || "")) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return true;
      }
      const node = fleetProxyNode(nodeId);
      const remoteTicket = await remoteFetch(node!, `/api/instances/${encodeURIComponent(name)}/terminal-ticket`, {}, 7000)
        .then((response) => response.json());
      if (!remoteTicket?.wsUrl) throw new Error("Remote terminal ticket was not returned");
      const remoteUrl = new URL(remoteTicket.wsUrl, node!.base_url);
      remoteUrl.protocol = remoteUrl.protocol === "https:" ? "wss:" : "ws:";
      const key = req.headers["sec-websocket-key"];
      if (!key) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return true;
      }
      const accept = crypto.createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
      socket.write(["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Accept: ${accept}`, "", ""].join("\r\n"));
      const remote = new WebSocket(remoteUrl);
      let frameBuffer: Buffer = Buffer.alloc(0);
      const cleanup = () => {
        try { remote.close(); } catch {}
        webSocketClose(socket);
      };
      remote.addEventListener("message", (event: any) => {
        const data = typeof event.data === "string" ? event.data : Buffer.from(event.data).toString("utf8");
        try {
          webSocketSend(socket, JSON.parse(data));
        } catch {
          webSocketSend(socket, { type: "output", data });
        }
      });
      remote.addEventListener("close", () => cleanup());
      remote.addEventListener("error", () => {
        webSocketSend(socket, { type: "status", status: "error" });
        cleanup();
      });
      socket.on("data", (chunk: Buffer) => {
        frameBuffer = Buffer.from(parseWebSocketFrames(Buffer.concat([frameBuffer, chunk]), (text) => {
          if (remote.readyState === WebSocket.OPEN) remote.send(text);
        }, cleanup));
      });
      socket.on("close", cleanup);
      socket.on("error", cleanup);
      return true;
    } catch (error: any) {
      socket.write(`HTTP/1.1 ${error.status || 500} Terminal Error\r\n\r\n`);
      socket.destroy();
      return true;
    }
  };
}
