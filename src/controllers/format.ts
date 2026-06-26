export function classNames(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function toDate(value: string | number | undefined | null): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return new Date(value < 1e12 ? value * 1000 : value);
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && /^\d+(\.\d+)?$/.test(String(value).trim())) {
    return new Date(numeric < 1e12 ? numeric * 1000 : numeric);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatTime(value?: string | number) {
  const date = toDate(value);
  if (!date) return value === undefined || value === null || value === "" ? "n/a" : String(value);
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  } catch {
    return String(value);
  }
}

export function stateLabel(instance: any) {
  if (!instance) return "Unknown";
  if (instance.pendingCreate || instance.state === "preparing") return "Getting ready";
  const requiresCamofox = instance.dependencies?.camofox !== false;
  if (instance.state === "running" && instance.health?.dashboard && (!requiresCamofox || instance.health?.camofox)) return "Healthy";
  if (instance.state === "running") return "Running";
  if (instance.state === "partial") return "Degraded";
  if (instance.state === "unknown") return "Unknown";
  return "Stopped";
}

export function stateTone(instance: any) {
  const label = stateLabel(instance);
  if (label === "Healthy") return "good";
  if (label === "Running" || label === "Getting ready") return "info";
  if (label === "Degraded") return "warn";
  return "muted";
}

function isAgentProvisioning(instance: any, jobs: any[] = []) {
  if (!instance) return false;
  if (instance.pendingCreate || instance.state === "preparing") return true;
  const nodeId = instance.nodeId || "local";
  return jobs.some((job) => job.instance === instance.name && (job.nodeId || "local") === nodeId && job.action === "create" && activeJob(job));
}

export function isAgentReady(instance: any, jobs: any[] = []) {
  return Boolean(instance && !isAgentProvisioning(instance, jobs));
}

export function activeJob(job: any) {
  return Boolean(job && ["queued", "running"].includes(job.status));
}

export function noVncUrl(url = "") {
  if (!url) return "";
  const target = new URL(url, window.location.origin);
  target.searchParams.set("autoconnect", "1");
  target.searchParams.set("resize", "scale");
  return target.toString();
}
