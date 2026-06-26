import type { Instance, Job } from "../models/fleet.ts";
import { isAgentReady } from "./format.ts";

export const FLEET_METRIC_HISTORY_KEY = "hermesFleetMetricHistory";

export type FleetMetricSnapshot = {
  checkedAt: number;
  agents: number;
  runningAgents: number;
  services: number;
  runningServices: number;
  serviceHealth: number;
  activeJobs: number;
  dataHealth: number;
};

export type FleetMetricSeriesKey = "runningAgents" | "serviceHealth" | "activeJobs" | "dataHealth";

const DEFAULT_MAX_SAMPLES = 48;
const DEFAULT_MIN_INTERVAL_MS = 60_000;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function buildFleetMetricSnapshot(instances: Instance[], jobs: Job[], checkedAt = Date.now()): FleetMetricSnapshot {
  const agents = instances.length;
  const runningAgents = instances.filter((instance) => instance.state === "running").length;
  const services = instances.reduce((sum, instance) => sum + Number(instance.serviceCount || 0), 0);
  const runningServices = instances.reduce((sum, instance) => sum + Number(instance.runningServices || 0), 0);
  const healthyAgents = instances.filter((instance) => isAgentReady(instance, jobs) && instance.memory?.ok !== false).length;
  const activeJobs = jobs.filter((job) => ["queued", "running"].includes(job.status)).length;

  return {
    checkedAt,
    agents,
    runningAgents,
    services,
    runningServices,
    serviceHealth: services ? percent(runningServices, services) : agents ? 100 : 0,
    activeJobs,
    dataHealth: percent(healthyAgents, agents),
  };
}

export function sanitizeFleetMetricHistory(value: unknown): FleetMetricSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const candidate = item as Partial<FleetMetricSnapshot>;
      const checkedAt = Number(candidate.checkedAt);
      const agents = Number(candidate.agents);
      const runningAgents = Number(candidate.runningAgents);
      const services = Number(candidate.services);
      const runningServices = Number(candidate.runningServices);
      const serviceHealth = Number(candidate.serviceHealth);
      const activeJobs = Number(candidate.activeJobs);
      const dataHealth = Number(candidate.dataHealth);
      if (![checkedAt, agents, runningAgents, services, runningServices, serviceHealth, activeJobs, dataHealth].every(Number.isFinite)) return null;
      return { checkedAt, agents, runningAgents, services, runningServices, serviceHealth, activeJobs, dataHealth };
    })
    .filter((item): item is FleetMetricSnapshot => Boolean(item))
    .sort((a, b) => a.checkedAt - b.checkedAt);
}

export function appendFleetMetricSnapshot(
  history: FleetMetricSnapshot[],
  snapshot: FleetMetricSnapshot,
  options: { maxSamples?: number; minIntervalMs?: number; maxAgeMs?: number } = {},
) {
  const maxSamples = options.maxSamples ?? DEFAULT_MAX_SAMPLES;
  const minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const recent = sanitizeFleetMetricHistory(history).filter((item) => snapshot.checkedAt - item.checkedAt <= maxAgeMs);
  const last = recent.at(-1);

  if (last && snapshot.checkedAt - last.checkedAt < minIntervalMs) {
    if (sameMetricValues(last, snapshot)) return recent;
    return [...recent.slice(0, -1), snapshot].slice(-maxSamples);
  }

  return [...recent, snapshot].slice(-maxSamples);
}

export function fleetMetricSeries(history: FleetMetricSnapshot[], key: FleetMetricSeriesKey, current: FleetMetricSnapshot) {
  const sanitized = sanitizeFleetMetricHistory(history);
  const last = sanitized.at(-1);
  const samples = last && last.checkedAt === current.checkedAt && sameMetricValues(last, current)
    ? sanitized
    : [...sanitized, current];
  const values = samples.slice(-DEFAULT_MAX_SAMPLES).map((sample) => sample[key]);
  return values.length ? values : [0];
}

export type SparklineGeometry = {
  points: string;
  baseline: number;
  width: number;
  height: number;
  padding: number;
};

export function sparklineGeometry(series: number[], width = 120, height = 28, padding = 4): SparklineGeometry {
  const values = series.map(Number).filter(Number.isFinite);
  const normalized = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
  const min = Math.min(...normalized);
  const max = Math.max(...normalized);
  const usableHeight = height - padding * 2;
  const range = max - min;

  const points = normalized
    .map((value, index) => {
      const x = normalized.length === 1 ? width : (index / (normalized.length - 1)) * width;
      const y = range === 0 ? height / 2 : height - padding - ((value - min) / range) * usableHeight;
      return `${trimNumber(x)},${trimNumber(y)}`;
    })
    .join(" ");

  const baselineY = range === 0 ? height / 2 : height - padding - ((0 - min) / range) * usableHeight;
  return { points, baseline: clamp(baselineY, padding, height - padding), width, height, padding };
}

export function sparklinePoints(series: number[], width = 120, height = 28, padding = 4) {
  return sparklineGeometry(series, width, height, padding).points;
}

export type TrendDelta = {
  direction: "up" | "down" | "flat";
  delta: number;
  suffix?: string;
};

export function trendDelta(series: number[], suffix = ""): TrendDelta | null {
  const values = series.map(Number).filter(Number.isFinite);
  if (values.length < 2) return null;
  const first = values.at(-2) ?? 0;
  const last = values.at(-1) ?? 0;
  const delta = Number((last - first).toFixed(suffix === "%" ? 1 : 0));
  if (delta === 0) return { direction: "flat", delta: 0, suffix };
  return { direction: delta > 0 ? "up" : "down", delta: Math.abs(delta), suffix };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sameMetricValues(a: FleetMetricSnapshot, b: FleetMetricSnapshot) {
  return a.agents === b.agents
    && a.runningAgents === b.runningAgents
    && a.services === b.services
    && a.runningServices === b.runningServices
    && a.serviceHealth === b.serviceHealth
    && a.activeJobs === b.activeJobs
    && a.dataHealth === b.dataHealth;
}

function trimNumber(value: number) {
  return Number(value.toFixed(1)).toString();
}
