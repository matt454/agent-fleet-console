import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("instance discovery canonicalizes visible agent directory entries", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "fleet-discovery-"));
  const target = path.join(root, ".target");
  const link = path.join(root, "linked");
  const capitalized = path.join(root, "Test");
  const previousRoot = process.env.HERMES_INSTANCES_ROOT;

  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "compose.yaml"), "services: {}\n");
  await fs.symlink(target, link);
  await fs.mkdir(capitalized, { recursive: true });
  await fs.writeFile(path.join(capitalized, "compose.yaml"), "services: {}\n");
  process.env.HERMES_INSTANCES_ROOT = root;

  try {
    const { discoverInstanceNames } = await import(`../server/services/instances.ts?root=${Date.now()}`);
    assert.deepEqual((await discoverInstanceNames()).sort(), ["linked", "test"]);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.HERMES_INSTANCES_ROOT;
    } else {
      process.env.HERMES_INSTANCES_ROOT = previousRoot;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});
