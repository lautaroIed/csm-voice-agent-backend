import { test } from "node:test";
import assert from "node:assert/strict";
import { sign, verify } from "retell-sdk";
import { createApp } from "../src/app.js";
import { AGENT_ID, hangUpCall, normalCall, urgentCall } from "./fixtures.js";

const KEY = "key_test_secret";

async function withServer(notify, fn) {
  const app = createApp({
    verify: (raw, sig) => verify(raw, KEY, sig),
    notify,
    agentId: AGENT_ID,
  });
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${server.address().port}/webhooks/retell`;
  try { await fn(url); } finally { server.close(); }
}

async function post(url, payload, { key = KEY, signature } = {}) {
  const body = JSON.stringify(payload);
  const sig = signature ?? (await sign(body, key));
  return fetch(url, { method: "POST", body, headers: { "content-type": "application/json", "x-retell-signature": sig } });
}

const recorder = (result = ["telegram", "email"]) => {
  const calls = [];
  const fn = async (r) => { calls.push(r); return typeof result === "function" ? result() : result; };
  fn.calls = calls;
  return fn;
};

test("rejects missing, wrong-key and malformed signatures", async () => {
  const notify = recorder();
  await withServer(notify, async (url) => {
    const payload = { event: "call_analyzed", call: normalCall };
    assert.equal((await post(url, payload, { signature: "" })).status, 401);
    assert.equal((await post(url, payload, { key: "another_key" })).status, 401);
    assert.equal((await post(url, payload, { signature: "v=1,d=abc" })).status, 401);
  });
  assert.equal(notify.calls.length, 0);
});

test("forwards call_analyzed once, even if Retell retries", async () => {
  const notify = recorder();
  await withServer(notify, async (url) => {
    const payload = { event: "call_analyzed", call: normalCall };
    assert.equal((await post(url, payload)).status, 204);
    assert.equal((await post(url, payload)).status, 204);
  });
  assert.equal(notify.calls.length, 1);
  assert.equal(notify.calls[0].callId, "call_normal_1");
});

test("ignores other events, other agents and empty hang-ups", async () => {
  const notify = recorder();
  await withServer(notify, async (url) => {
    assert.equal((await post(url, { event: "call_ended", call: normalCall })).status, 204);
    assert.equal((await post(url, { event: "call_analyzed", call: { ...normalCall, call_id: "x", agent_id: "agent_old" } })).status, 204);
    assert.equal((await post(url, { event: "call_analyzed", call: hangUpCall })).status, 204);
  });
  assert.equal(notify.calls.length, 0);
});

test("urgent calls are forwarded flagged", async () => {
  const notify = recorder();
  await withServer(notify, async (url) => {
    assert.equal((await post(url, { event: "call_analyzed", call: urgentCall })).status, 204);
  });
  assert.equal(notify.calls[0].urgent, true);
});

test("returns 502 when no channel delivered, so Retell retries, then delivers", async () => {
  let attempt = 0;
  const notify = recorder(() => (++attempt === 1 ? [] : ["telegram"]));
  await withServer(notify, async (url) => {
    const payload = { event: "call_analyzed", call: normalCall };
    assert.equal((await post(url, payload)).status, 502);
    assert.equal((await post(url, payload)).status, 204);
    assert.equal((await post(url, payload)).status, 204);
  });
  assert.equal(notify.calls.length, 2, "third request deduped after the successful retry");
});
