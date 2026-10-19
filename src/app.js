import express from "express";
import { createWebhookHandler, memoryStore } from "./webhook.js";

/** Express app for running as a normal Node server (local dev, VPS). Netlify uses netlify/functions. */
export function createApp({ verify, notify, agentId = null, timezone = "Europe/Madrid", store = memoryStore() }) {
  const handle = createWebhookHandler({ verify, notify, store, agentId, timezone });
  const app = express();
  app.disable("x-powered-by");

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.post("/webhooks/retell", express.raw({ type: "*/*", limit: "5mb" }), async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    res.status(await handle(raw, req.get("x-retell-signature"))).end();
  });

  return app;
}
