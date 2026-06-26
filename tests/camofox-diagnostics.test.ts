import test from "node:test";
import assert from "node:assert/strict";
import { addonManifestSignature, camofoxLaunchStateDiagnostic } from "../server/services/camofox-diagnostics.ts";

const manifests = [
  { name: "custom-addon", mtimeMs: 1000 },
  { name: "ublock-origin", mtimeMs: 2000 },
];

test("addon signature changes invalidate stale launch state", () => {
  const diagnostic = camofoxLaunchStateDiagnostic({ addonSignature: "custom-addon:999|ublock-origin:2000" }, manifests);

  assert.equal(diagnostic.reusable, false);
  assert.equal(diagnostic.stale, true);
  assert.equal(diagnostic.reason, "addon_signature_changed");
  assert.ok(diagnostic.hints.includes("stale_browser_launch_state"));
});

test("existing state is reused only when addon signature matches", () => {
  const signature = addonManifestSignature(manifests);
  const matching = camofoxLaunchStateDiagnostic({ addonSignature: signature }, manifests);
  const missingSignature = camofoxLaunchStateDiagnostic({}, manifests);

  assert.equal(matching.reusable, true);
  assert.equal(matching.stale, false);
  assert.equal(missingSignature.reusable, false);
  assert.ok(missingSignature.hints.includes("stale_camofox_image"));
});
