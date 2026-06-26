import path from "node:path";
import { ROOT } from "../config.ts";

function composeProject(name: string) {
  return `hermes_${name.replace(/[^A-Za-z0-9]/g, "_")}`;
}

export function instanceDir(name: string) {
  return path.join(ROOT, name);
}

export function composeFile(name: string) {
  return path.join(instanceDir(name), "compose.yaml");
}

export function homeDir(name: string) {
  return path.join(instanceDir(name), "home");
}

export function workspaceDir(name: string) {
  return path.join(instanceDir(name), "workspace");
}

export function composeArgs(name: string, ...args: string[]) {
  return ["compose", "-p", composeProject(name), "-f", composeFile(name), ...args];
}

export function composeExecArgs(name: string, service: string, commandArgs: string[], env: Record<string, string> = {}) {
  const envArgs = Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]);
  return [
    ...composeArgs(name, "exec", "-T", ...envArgs, "-e", "HOME=/opt/data", "-w", "/opt/data/workspace", service),
    ...commandArgs,
  ];
}
