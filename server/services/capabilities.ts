import fs from "node:fs/promises";
import path from "node:path";
import { HERMES_DOCKER } from "../config.ts";
import { run } from "../lib/process.ts";
import { composeExecArgs, workspaceDir } from "./compose.ts";
import { runNemoHermesExec, runNemoHermesSkillInstall } from "./nemoclaw.ts";
import { PAYMENTS_ACCOUNT, PAYMENTS_CLIENT, PAYMENTS_CLIENT_PATH, PAYMENTS_SKILL } from "./payment-constants.ts";
import { writePaymentPolicy } from "./payment-policy.ts";

type CreateCapabilities = {
  payments?: boolean;
};

async function writePaymentsInstructions(name: string) {
  const workspace = workspaceDir(name);
  await fs.mkdir(workspace, { recursive: true });
  await fs.writeFile(path.join(workspace, "HERMES_PAYMENTS.md"), `# Hermes Payments Capability

This agent was created with payments support.

- Hermes optional skill: \`${PAYMENTS_SKILL}\`
- Purpose: pay HTTP 402 APIs via Machine Payments Protocol (MPP).
- Default wallet client: \`${PAYMENTS_CLIENT}\`.
- Default account: \`${PAYMENTS_ACCOUNT}\`.
- Client install path: \`${PAYMENTS_CLIENT_PATH}\`.
- Verification: \`mppx --version && mppx account list\`.
- Wallet clients may include Tempo Wallet, Privy Agent CLI, AgentCash, mppx, or Stripe Link when the 402 challenge advertises Stripe.
- Do not paste wallet keys, account credentials, payment tokens, or private key material into chat, logs, or project files. Payment clients should keep credentials in their own config stores.
- Before paying a non-zero amount, clearly confirm the target URL, method, amount, currency, and spending source with the operator.
`);
}

function paymentsBootstrapScript() {
  return `
set -euo pipefail
export NPM_CONFIG_PREFIX="/opt/data/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
mkdir -p "$NPM_CONFIG_PREFIX/bin"
for profile in /opt/data/.profile /opt/data/.bashrc; do
  touch "$profile"
  grep -qxF 'export PATH="/opt/data/.npm-global/bin:$PATH"' "$profile" || echo 'export PATH="/opt/data/.npm-global/bin:$PATH"' >> "$profile"
done
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to install mppx" >&2
  exit 1
fi
if ! command -v mppx >/dev/null 2>&1; then
  npm install -g mppx
fi
if ! mppx account list 2>/dev/null | grep -F "${PAYMENTS_ACCOUNT}" >/dev/null 2>&1; then
  mppx account create --account "${PAYMENTS_ACCOUNT}" >/dev/null
fi
mppx account default --account "${PAYMENTS_ACCOUNT}" 2>/dev/null || true
mppx --version
mppx account list
`;
}

async function bootstrapPaymentsWallet(name: string, runtime: string) {
  const script = paymentsBootstrapScript();
  if (runtime === "nemoclaw") return runNemoHermesExec(name, script, 180000);
  return run("docker", composeExecArgs(name, "hermes", ["bash", "-lc", script]), {
    timeout: 180000,
    maxBuffer: 1024 * 1024 * 4,
  });
}

export async function applyCreateCapabilities(name: string, capabilities: CreateCapabilities = {}, runtime = "docker") {
  if (!capabilities.payments) return { payments: false };
  await writePaymentsInstructions(name);
  await writePaymentPolicy(name, { defaultAccount: PAYMENTS_ACCOUNT });
  if (runtime === "nemoclaw") {
    await runNemoHermesSkillInstall(name, PAYMENTS_SKILL, 120000);
  } else {
    await run(HERMES_DOCKER, ["hermes", name, "skills", "install", PAYMENTS_SKILL], {
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 4,
    });
  }
  await bootstrapPaymentsWallet(name, runtime);
  return { payments: true, skill: PAYMENTS_SKILL, wallet: PAYMENTS_CLIENT, account: PAYMENTS_ACCOUNT };
}
