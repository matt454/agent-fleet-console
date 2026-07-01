import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("instance discovery canonicalizes visible agent directory entries", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "fleet-discovery-"));
  const dataDir = path.join(root, "data");
  const target = path.join(root, ".target");
  const link = path.join(root, "linked");
  const capitalized = path.join(root, "Test");
  const previousRoot = process.env.HERMES_INSTANCES_ROOT;
  const previousDataDir = process.env.HERMES_CONSOLE_DATA_DIR;
  const previousDb = process.env.HERMES_CONSOLE_DB;
  const previousSecretsDir = process.env.HERMES_CONSOLE_SECRETS_DIR;

  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(target, "compose.yaml"), "services: {}\n");
  await fs.symlink(target, link);
  await fs.mkdir(capitalized, { recursive: true });
  await fs.writeFile(path.join(capitalized, "compose.yaml"), "services: {}\n");
  process.env.HERMES_INSTANCES_ROOT = root;
  process.env.HERMES_CONSOLE_DATA_DIR = dataDir;
  process.env.HERMES_CONSOLE_DB = path.join(dataDir, "fleet.db");
  process.env.HERMES_CONSOLE_SECRETS_DIR = path.join(root, "secrets");

  try {
    const { discoverInstanceNames } = await import(`../server/services/instances.ts?root=${Date.now()}`);
    assert.deepEqual((await discoverInstanceNames()).sort(), ["linked", "test"]);
  } finally {
    restoreEnv("HERMES_INSTANCES_ROOT", previousRoot);
    restoreEnv("HERMES_CONSOLE_DATA_DIR", previousDataDir);
    restoreEnv("HERMES_CONSOLE_DB", previousDb);
    restoreEnv("HERMES_CONSOLE_SECRETS_DIR", previousSecretsDir);
    await fs.rm(root, { recursive: true, force: true });
  }
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
