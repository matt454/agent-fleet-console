import { execFile } from "node:child_process";

type RunOptions = {
  cwd?: string;
  env?: Record<string, string>;
  jobId?: number;
  maxBuffer?: number;
  stdin?: string;
  timeout?: number;
};

const activeChildren = new Map<number, ReturnType<typeof execFile>>();

export function run(command: string, args: string[] = [], options: RunOptions = {}) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = execFile(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      maxBuffer: options.maxBuffer || 1024 * 1024 * 8,
      timeout: options.timeout || 120000,
    }, (error, stdout, stderr) => {
      if (options.jobId) activeChildren.delete(options.jobId);
      if (error) {
        Object.assign(error, { stdout, stderr });
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
    if (options.jobId) activeChildren.set(options.jobId, child);
    if (options.stdin !== undefined) {
      child.stdin?.end(options.stdin);
    }
  });
}

export function cancelProcess(jobId: number) {
  const child = activeChildren.get(jobId);
  if (!child) return false;
  child.kill("SIGTERM");
  activeChildren.delete(jobId);
  return true;
}

export function jobErrorText(error: unknown) {
  if (error && typeof error === "object") {
    const detail = error as { stderr?: unknown; stdout?: unknown; message?: unknown };
    return String(detail.stderr || detail.stdout || detail.message || error);
  }
  return String(error);
}
