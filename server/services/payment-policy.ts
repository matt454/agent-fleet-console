import fs from "node:fs/promises";
import path from "node:path";
import { readTextIfExists, writePrivateFile } from "../lib/env-file.ts";
import { workspaceDir } from "./compose.ts";

export type PaymentPolicy = {
  enabled: boolean;
  currency: string;
  taskBudget: number;
  approvalThreshold: number;
  requireApproval: boolean;
  defaultAccount: string;
  notes: string;
  updatedAt: string;
};

const DEFAULT_PAYMENT_POLICY: PaymentPolicy = {
  enabled: true,
  currency: "USD",
  taskBudget: 25,
  approvalThreshold: 1,
  requireApproval: true,
  defaultAccount: "hermes-payments",
  notes: "Confirm target, method, amount, currency, and payment source before approving non-zero spend.",
  updatedAt: "",
};

function policyPath(name: string) {
  return path.join(workspaceDir(name), "HERMES_PAYMENTS_POLICY.json");
}

function policyMarkdownPath(name: string) {
  return path.join(workspaceDir(name), "HERMES_PAYMENTS_POLICY.md");
}

function cleanMoney(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.round(number * 100) / 100;
}

function normalizePaymentPolicy(value: any = {}, fallback: PaymentPolicy = DEFAULT_PAYMENT_POLICY): PaymentPolicy {
  const currency = String(value.currency || fallback.currency || "USD").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "USD";
  return {
    enabled: value.enabled !== false,
    currency,
    taskBudget: cleanMoney(value.taskBudget, fallback.taskBudget),
    approvalThreshold: cleanMoney(value.approvalThreshold, fallback.approvalThreshold),
    requireApproval: value.requireApproval !== false,
    defaultAccount: String(value.defaultAccount || fallback.defaultAccount || "hermes-payments").trim().slice(0, 80),
    notes: String(value.notes || fallback.notes || "").trim().slice(0, 1000),
    updatedAt: String(value.updatedAt || fallback.updatedAt || ""),
  };
}

export async function readPaymentPolicy(name: string): Promise<PaymentPolicy> {
  const text = await readTextIfExists(policyPath(name));
  if (!text.trim()) return { ...DEFAULT_PAYMENT_POLICY };
  try {
    return normalizePaymentPolicy(JSON.parse(text), DEFAULT_PAYMENT_POLICY);
  } catch {
    return { ...DEFAULT_PAYMENT_POLICY };
  }
}

async function writePaymentPolicyMarkdown(name: string, policy: PaymentPolicy) {
  await fs.writeFile(policyMarkdownPath(name), `# Hermes Payment Spend Controls

- Payments enabled: ${policy.enabled ? "yes" : "no"}
- Default account: \`${policy.defaultAccount}\`
- Per-task budget: ${policy.currency} ${policy.taskBudget.toFixed(2)}
- Approval threshold: ${policy.currency} ${policy.approvalThreshold.toFixed(2)}
- Approval required: ${policy.requireApproval ? "yes" : "no"}

${policy.notes}
`);
}

export async function writePaymentPolicy(name: string, value: Partial<PaymentPolicy> = {}) {
  const existing = await readPaymentPolicy(name);
  const policy = normalizePaymentPolicy({ ...existing, ...value, updatedAt: new Date().toISOString() }, existing);
  await fs.mkdir(workspaceDir(name), { recursive: true });
  await writePrivateFile(policyPath(name), `${JSON.stringify(policy, null, 2)}\n`);
  await writePaymentPolicyMarkdown(name, policy);
  return policy;
}
