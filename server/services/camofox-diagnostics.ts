import fs from "node:fs/promises";
import path from "node:path";
import { homeDir } from "./compose.ts";

type AddonManifestInput = {
  name: string;
  mtimeMs?: number;
};

export type CamofoxLaunchStateDiagnostic = {
  statePath?: string;
  addonRoot?: string;
  statePresent: boolean;
  stateSignature: string;
  addonSignature: string;
  addonManifestCount: number;
  customAddonManifestCount: number;
  builtInOnly: boolean;
  reusable: boolean;
  stale: boolean;
  reason: string;
  hints: string[];
};

function builtInAddonName(name: string) {
  return /^(ublock|ubo|ublock-origin|uBlock0)$/i.test(name) || /ublock|ubo/i.test(name);
}

export function addonManifestSignature(manifests: AddonManifestInput[]) {
  return manifests
    .map((manifest) => `${manifest.name}:${Math.round(Number(manifest.mtimeMs || 0))}`)
    .sort()
    .join("|");
}

export function camofoxLaunchStateDiagnostic(state: any, manifests: AddonManifestInput[] = []): CamofoxLaunchStateDiagnostic {
  const list = Array.isArray(manifests) ? manifests : [];
  const statePresent = Boolean(state && typeof state === "object");
  const stateSignature = String(state?.addonSignature || "");
  const addonSignature = addonManifestSignature(list);
  const customAddonManifestCount = list.filter((manifest) => !builtInAddonName(manifest.name)).length;
  const builtInOnly = list.length > 0 && customAddonManifestCount === 0;
  const stale = statePresent && Boolean(stateSignature) && stateSignature !== addonSignature;
  const reusable = statePresent && Boolean(stateSignature) && stateSignature === addonSignature;
  const hints: string[] = [];

  if (!statePresent) hints.push("missing_browser_launch_state");
  if (statePresent && !stateSignature) hints.push("stale_camofox_image");
  if (stale) hints.push("stale_browser_launch_state");
  if (builtInOnly || (statePresent && !customAddonManifestCount)) hints.push("custom_addon_manifest_missing");

  return {
    statePresent,
    stateSignature,
    addonSignature,
    addonManifestCount: list.length,
    customAddonManifestCount,
    builtInOnly,
    reusable,
    stale,
    reason: stale ? "addon_signature_changed" : reusable ? "addon_signature_match" : hints[0] || "ok",
    hints: Array.from(new Set(hints)),
  };
}

async function readJsonIfExists(file: string) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function addonManifests(addonRoot: string): Promise<AddonManifestInput[]> {
  try {
    const entries = await fs.readdir(addonRoot, { withFileTypes: true });
    const manifests = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
      const manifestPath = path.join(addonRoot, entry.name, "manifest.json");
      try {
        const stat = await fs.stat(manifestPath);
        return { name: entry.name, mtimeMs: stat.mtimeMs };
      } catch {
        return null;
      }
    }));
    return manifests.filter(Boolean) as AddonManifestInput[];
  } catch {
    return [];
  }
}

export async function camofoxDiagnosticsForInstance(name: string) {
  const statePath = path.join(homeDir(name), "browser_auth", "camofox", "profiles", "browser-launch-state.json");
  const addonRoot = path.join(homeDir(name), "home", ".cache", "camoufox", "addons");
  const diagnostic = camofoxLaunchStateDiagnostic(await readJsonIfExists(statePath), await addonManifests(addonRoot));
  return { ...diagnostic, statePath, addonRoot };
}
