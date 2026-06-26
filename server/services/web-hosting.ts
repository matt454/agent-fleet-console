import fs from "node:fs/promises";
import path from "node:path";
import { parseEnv, readTextIfExists } from "../lib/env-file.ts";
import { instanceDir, workspaceDir } from "./compose.ts";

export function webInfoFromEnv(name: string, env: Record<string, string>, lanAddress: string) {
  const port = Number(env.WEB_PORT);
  return {
    port: port || null,
    localUrl: port ? `http://127.0.0.1:${port}` : "",
    lanUrl: port ? `http://${lanAddress}:${port}` : "",
    root: path.join(workspaceDir(name), "web"),
  };
}

async function webInfo(name: string, lanAddress: string) {
  const env = parseEnv(await readTextIfExists(path.join(instanceDir(name), "instance.env")));
  return webInfoFromEnv(name, env, lanAddress);
}

export async function writeWebInstructions(name: string, lanAddress: string) {
  const info = await webInfo(name, lanAddress);
  if (!info.port) return { written: false };

  const workspace = workspaceDir(name);
  await fs.mkdir(info.root, { recursive: true });
  await fs.writeFile(path.join(workspace, "HERMES_WEB.md"), `# Hermes Web Publishing

This agent can publish a locally hosted web page from its workspace.

- When a user asks you to create, host, publish, preview, or update a webpage, write the files here.
- Put site files in \`/opt/data/workspace/web\`.
- Use \`/opt/data/workspace/web/index.html\` as the default page.
- Use relative paths for CSS, JavaScript, images, and other assets.
- The local URL is \`${info.localUrl}\`.
- The LAN URL is \`${info.lanUrl}\`.
- In the agent environment, read \`HERMES_WEB_ROOT\`, \`HERMES_WEB_URL\`, and \`HERMES_WEB_LAN_URL\` when you need these values.

The web host serves static files and falls back to \`index.html\` for single-page apps. Do not use another port unless the user explicitly asks for a custom server.
`);
  return { written: true, path: path.join(workspace, "HERMES_WEB.md"), ...info };
}
