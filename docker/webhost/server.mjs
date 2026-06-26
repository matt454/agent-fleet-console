import { createReadStream, promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.env.HERMES_WEB_ROOT || "/opt/data/workspace/web");
const bind = process.env.HERMES_WEB_BIND || "0.0.0.0";
const port = Number(process.env.HERMES_WEB_CONTAINER_PORT || 4173);

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
]);

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers,
  });
  res.end(body);
}

function emptyPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Web Host</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #f7f7f5; color: #171717; }
    main { width: min(640px, calc(100vw - 40px)); border: 1px solid #ddd8ce; background: #fff; border-radius: 8px; padding: 28px; box-shadow: 0 18px 50px rgb(15 23 42 / 0.08); }
    h1 { margin: 0 0 8px; font-size: 22px; line-height: 1.2; }
    p { margin: 0; color: #5f5b53; line-height: 1.55; }
    code { border: 1px solid #ddd8ce; border-radius: 6px; padding: 2px 5px; background: #f7f7f5; }
    @media (prefers-color-scheme: dark) {
      body { background: #121212; color: #f3f3ef; }
      main { background: #1d1d1b; border-color: #34342f; box-shadow: none; }
      p { color: #b9b5ab; }
      code { background: #282823; border-color: #3c3c35; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Agent web host is ready</h1>
    <p>Create <code>/opt/data/workspace/web/index.html</code> to publish a page from this agent.</p>
  </main>
</body>
</html>`;
}

async function resolveRequest(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0] || "/");
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const requested = path.resolve(root, `.${normalized}`);
  if (!requested.startsWith(`${root}${path.sep}`) && requested !== root) return null;

  try {
    const stat = await fs.stat(requested);
    if (stat.isDirectory()) {
      const indexFile = path.join(requested, "index.html");
      try {
        const indexStat = await fs.stat(indexFile);
        if (indexStat.isFile()) return indexFile;
      } catch {
        // Fall through to the root SPA fallback or empty page.
      }
    }
    if (stat.isFile()) return requested;
  } catch {
    // Fall through to SPA fallback.
  }

  const fallback = path.join(root, "index.html");
  try {
    const stat = await fs.stat(fallback);
    return stat.isFile() ? fallback : "";
  } catch {
    return "";
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") return send(res, 200, JSON.stringify({ ok: true, service: "hermes-webhost" }), { "content-type": "application/json; charset=utf-8" });
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed\n", { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" });

  let file = "";
  try {
    file = await resolveRequest(req.url || "/");
  } catch {
    return send(res, 400, "Bad request\n", { "content-type": "text/plain; charset=utf-8" });
  }

  if (!file) return send(res, 200, emptyPage(), { "content-type": "text/html; charset=utf-8" });

  const type = MIME_TYPES.get(path.extname(file).toLowerCase()) || "application/octet-stream";
  res.writeHead(200, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).on("error", () => {
    if (!res.headersSent) send(res, 404, "Not found\n", { "content-type": "text/plain; charset=utf-8" });
    else res.destroy();
  }).pipe(res);
});

server.listen(port, bind, () => {
  const script = fileURLToPath(import.meta.url);
  console.log(`Hermes webhost serving ${root} on ${bind}:${port} via ${script}`);
});
