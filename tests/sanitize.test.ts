import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeJsonText } from "../server/lib/sanitize.ts";

test("job output sanitization redacts common secret shapes", () => {
  const openAiKey = `sk-${"abcdefghijklmnopqrstuvwxyz123456"}`;
  const bearerToken = `${"abcdefghijklmnopqrstuvwxyz"}${"ABCDEFGHIJKL1234567890"}`;
  const telegramToken = `${"123456789"}:${"abcdefghijklmnopqrstuvwxyzABCDE"}`;
  const githubToken = `ghp_${"abcdefghijklmnopqrstuvwxyzABCDE1234567890"}`;
  const text = sanitizeJsonText([
    `OPENAI_API_KEY=${openAiKey}`,
    `raw key ${openAiKey}`,
    `Authorization: Bearer ${bearerToken}`,
    `TELEGRAM_BOT_TOKEN=${telegramToken}`,
    `GITHUB_TOKEN=${githubToken}`,
  ].join("\n"));

  assert.equal(text.includes(openAiKey), false);
  assert.equal(text.includes(bearerToken), false);
  assert.equal(text.includes(telegramToken), false);
  assert.equal(text.includes(githubToken), false);
  assert.match(text, /OPENAI_API_KEY=\[redacted\]/);
  assert.match(text, /\[redacted-openai-key\]/);
  assert.match(text, /Bearer \[redacted-token\]/);
  assert.match(text, /TELEGRAM_BOT_TOKEN=\[redacted\]/);
  assert.match(text, /GITHUB_TOKEN=\[redacted\]/);
});
