import test from "node:test";
import assert from "node:assert/strict";
import type { Instance, Job } from "../src/models/fleet.ts";
import { appendFleetMetricSnapshot, buildFleetMetricSnapshot, fleetMetricSeries, sparklineGeometry, sparklinePoints, trendDelta, type FleetMetricSnapshot } from "../src/controllers/fleet-metrics.ts";

function instance(partial: Partial<Instance>): Instance {
  return {
    name: "agent",
    state: "running",
    services: [],
    serviceCount: 0,
    runningServices: 0,
    health: {},
    memory: {},
    capabilities: {},
    endpoints: {},
    ports: {},
    dependencies: {},
    network: {},
    config: {},
    update: {},
    drift: {},
    timeline: [],
    ...partial,
  };
}

function snapshot(partial: Partial<FleetMetricSnapshot>): FleetMetricSnapshot {
  return {
    checkedAt: 0,
    agents: 0,
    runningAgents: 0,
    services: 0,
    runningServices: 0,
    serviceHealth: 0,
    activeJobs: 0,
    dataHealth: 0,
    ...partial,
  };
}

test("fleet metric snapshot is derived from actual fleet state", () => {
  const jobs = [
    { id: 1, action: "update", instance: "alpha", status: "running", progress: 25 },
    { id: 2, action: "backup", instance: "beta", status: "completed", progress: 100 },
  ] as Job[];
  const metrics = buildFleetMetricSnapshot([
    instance({ name: "alpha", state: "running", serviceCount: 2, runningServices: 1, memory: { ok: true } }),
    instance({ name: "beta", state: "stopped", serviceCount: 1, runningServices: 0, memory: { ok: false } }),
  ], jobs, 1234);

  assert.equal(metrics.checkedAt, 1234);
  assert.equal(metrics.agents, 2);
  assert.equal(metrics.runningAgents, 1);
  assert.equal(metrics.services, 3);
  assert.equal(metrics.runningServices, 1);
  assert.equal(metrics.serviceHealth, 33);
  assert.equal(metrics.activeJobs, 1);
  assert.equal(metrics.dataHealth, 50);
});

test("metric history replaces noisy near-term changes and appends later samples", () => {
  const first = snapshot({ checkedAt: 1_000, agents: 1, runningAgents: 1 });
  const changedSoon = snapshot({ checkedAt: 2_000, agents: 1, runningAgents: 0 });
  const later = snapshot({ checkedAt: 70_000, agents: 1, runningAgents: 1 });

  assert.deepEqual(appendFleetMetricSnapshot([first], first, { minIntervalMs: 60_000 }), [first]);
  assert.deepEqual(appendFleetMetricSnapshot([first], changedSoon, { minIntervalMs: 60_000 }), [changedSoon]);
  assert.deepEqual(appendFleetMetricSnapshot([first], later, { minIntervalMs: 60_000 }), [first, later]);
});

test("sparkline points are generated from the metric series", () => {
  assert.equal(sparklinePoints([0, 10]), "0,24 120,4");
  assert.equal(sparklinePoints([5]), "0,14 120,14");
});

test("metric series includes the current sample for rendering", () => {
  const first = snapshot({ checkedAt: 1_000, activeJobs: 0 });
  const current = snapshot({ checkedAt: 70_000, activeJobs: 2 });

  assert.deepEqual(fleetMetricSeries([first], "activeJobs", current), [0, 2]);
});
