import { test } from "node:test";
import assert from "node:assert/strict";
import { sign } from "retell-sdk";
import { AGENT_ID, normalCall } from "./fixtures.js";

// config.js reads the environment on import, so set it before loading the function.
Object.assign(process.env, {
  RETELL_API_KEY: "key_test_secret",
  RETELL_AGENT_ID: AGENT_ID,
  TELEGRAM_BOT_TOKEN: "test-token",
  TELEGRAM_CHAT_ID: "-1",
  DRY_RUN: "telegram,email",
});
const { default: handler, config } = await import("../netlify/functions/retell-webhook.mjs");
const { default: health } = await import("../netlify/functions/health.mjs");

const URL_ = "https://example.netlify.app/webhooks/retell";

async function request(payload, key = "key_test_secret") {
  const body = JSON.stringify(payload);
  return new Request(URL_, {
    method: "POST", body,
    headers: { "content-type": "application/json", "x-retell-signature": await sign(body, key) },
  });
}

test("routes to /webhooks/retell", () => {
  assert.equal(config.path, "/webhooks/retell");
});

test("accepts a signed call_analyzed and rejects a bad signature", async () => {
  const payload = { event: "call_analyzed", call: { ...normalCall, call_id: "netlify_1" } };
  assert.equal((await handler(await request(payload))).status, 204);
  assert.equal((await handler(await request(payload, "wrong_key"))).status, 401);
});

test("rejects non-POST", async () => {
  assert.equal((await handler(new Request(URL_))).status, 405);
});

test("health answers ok", async () => {
  assert.deepEqual(await (await health()).json(), { ok: true });
});
