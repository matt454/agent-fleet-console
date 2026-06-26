import { AlertTriangle, CircleStop, Terminal, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { api } from "../controllers/api.ts";
import type { Instance } from "../models/fleet.ts";
import { Button } from "../components/ui/button.tsx";
import { Alert } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Card, CardContent } from "../components/ui/card.tsx";
import { Spinner } from "../components/ui/spinner.tsx";
import { DashboardPanelHeader } from "../components/layout/FleetShell.tsx";

export function TerminalPane({ selected }: { selected: Instance }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState("idle");
  const [statusDetail, setStatusDetail] = useState("");
  const connected = status === "connected";
  const connecting = status === "connecting";

  function fitTerminal() {
    const host = hostRef.current;
    if (!host || !fitRef.current) return;
    if (!host.clientWidth || !host.clientHeight) return;
    try {
      fitRef.current.fit();
    } catch (error: any) {
      setStatus("error");
      setStatusDetail(error.message || "Terminal could not fit the available space.");
    }
  }

  function ensureTerminal() {
    if (termRef.current || !hostRef.current) return termRef.current;
    try {
      const term = new XTerm({ cursorBlink: true, fontSize: 13, convertEol: true, theme: { background: "#07111f" } });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(hostRef.current);
      term.onData((data) => {
        const socket = socketRef.current;
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "input", data }));
      });
      termRef.current = term;
      fitRef.current = fit;
      window.requestAnimationFrame(fitTerminal);
      return term;
    } catch (error: any) {
      setStatus("error");
      setStatusDetail(error.message || "Terminal could not be initialized.");
      return null;
    }
  }

  async function connect() {
    const term = ensureTerminal();
    if (!term || connected || connecting) return;
    setStatus("connecting");
    setStatusDetail("");
    try {
      const ticket = await api<{ wsUrl: string }>(`/api/fleet/${encodeURIComponent(selected.nodeId || "local")}/instances/${encodeURIComponent(selected.name)}/terminal-ticket`);
      const url = new URL(ticket.wsUrl, window.location.href);
      url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      if (term.cols) url.searchParams.set("cols", String(term.cols));
      if (term.rows) url.searchParams.set("rows", String(term.rows));
      const authToken = window.localStorage.getItem("hermesConsoleToken") || "";
      if (authToken) url.searchParams.set("auth", authToken);
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onmessage = (event) => {
        let message: any = null;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === "output") term.write(message.data);
        if (message.type === "status") setStatus(message.status || "connected");
      };
      socket.onerror = () => {
        setStatus("error");
        setStatusDetail("Terminal websocket failed. Refresh the gateway or restart the API server, then try again.");
      };
      socket.onclose = (event) => {
        socketRef.current = null;
        setStatus((current) => current === "error" ? "error" : "closed");
        if (event.code && event.code !== 1000) setStatusDetail(`Terminal connection closed with code ${event.code}.`);
      };
    } catch (err: any) {
      setStatus("error");
      setStatusDetail(err.message || "Could not create a terminal ticket.");
    }
  }

  function disconnect() {
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("closed");
  }

  useEffect(() => {
    ensureTerminal();
    const resize = () => fitTerminal();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      disconnect();
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, [selected.name]);

  return (
    <Card as="section" className="terminal-card">
      <DashboardPanelHeader
        title="Container terminal"
        subtitle={selected.name}
        actions={
          <>
            <Badge variant={connected ? "success" : connecting ? "default" : status === "error" ? "warning" : "secondary"}>{status}</Badge>
            <Button variant="outline" size="sm" onClick={() => termRef.current?.clear()}>
              <Trash2 data-icon="inline-start" />
              Clear
            </Button>
            {connected || connecting ? (
              <Button variant="destructive" size="sm" onClick={disconnect}><CircleStop data-icon="inline-start" />Disconnect</Button>
            ) : (
              <Button size="sm" onClick={connect}>
                {connecting ? <Spinner data-icon="inline-start" /> : <Terminal data-icon="inline-start" />}
                Connect
              </Button>
            )}
          </>
        }
      />
      {status === "error" && statusDetail ? (
        <Alert variant="warning" className="terminal-alert">
          <AlertTriangle />
          <span>{statusDetail}</span>
        </Alert>
      ) : null}
      <CardContent className="terminal-content"><div className="terminal-shell" ref={hostRef} /></CardContent>
    </Card>
  );
}
