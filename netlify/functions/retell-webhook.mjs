import { getStore } from "@netlify/blobs";
import { verify } from "retell-sdk";
import { config as appConfig } from "../../src/config.js";
import { notify } from "../../src/notify.js";
import { createWebhookHandler, memoryStore } from "../../src/webhook.js";

// Each serverless instance has its own memory, so dedupe lives in Netlify Blobs.
// The store is opened per call (Blobs' context is only guaranteed during a request) and
// falls back to memory, best effort, if Blobs isn't available.
function blobStore() {
  const fallback = memoryStore();
  const open = () => getStore({ name: "delivered-calls", consistency: "strong" });
  return {
    async has(id) {
      try {
        return (await open().get(id)) !== null;
      } catch (e) {
        console.error(`dedupe read failed, using memory: ${e.message}`);
        return fallback.has(id);
      }
    },
    async add(id) {
      await fallback.add(id);
      await open().set(id, new Date().toISOString());
    },
  };
}

const handle = createWebhookHandler({
  verify: async (raw, signature) => Boolean(await verify(raw, appConfig.retell.apiKey, signature)),
  notify,
  store: blobStore(),
  agentId: appConfig.retell.agentId,
  timezone: appConfig.timezone,
});

export default async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const status = await handle(await req.text(), req.headers.get("x-retell-signature"));
  return new Response(null, { status });
};

export const config = { path: "/webhooks/retell" };
