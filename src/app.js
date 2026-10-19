import express from "express";
import { buildRecado } from "./recado.js";

const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * @param {object} deps
 * @param {(rawBody: string, signature: string) => Promise<boolean>} deps.verify
 * @param {(recado: object) => Promise<string[]>} deps.notify  returns channels that succeeded
 * @param {string|null} deps.agentId  only calls from this agent are forwarded
 * @param {string} deps.timezone
 */
export function createApp({ verify, notify, agentId = null, timezone = "Europe/Madrid" }) {
  const app = express();
  app.disable("x-powered-by");

  // Retell retries a webhook up to 3 times. Remember what we already delivered so a
  // retry after a slow but successful send doesn't post the same recado twice.
  const delivered = new Map();
  const alreadyDelivered = (id) => {
    const now = Date.now();
    for (const [k, t] of delivered) if (now - t > DEDUPE_TTL_MS) delivered.delete(k);
    return delivered.has(id);
  };

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Raw body: the signature is computed over the exact bytes Retell sent.
  app.post("/webhooks/retell", express.raw({ type: "*/*", limit: "5mb" }), async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    const signature = req.get("x-retell-signature");
    if (!signature || !(await verify(raw, signature).catch(() => false))) {
      return res.status(401).end();
    }

    let event, call;
    try {
      ({ event, call } = JSON.parse(raw));
    } catch {
      return res.status(400).end();
    }

    // call_started / call_ended carry no analysis yet; only call_analyzed has the recado.
    if (event !== "call_analyzed" || !call?.call_id) return res.status(204).end();
    if (agentId && call.agent_id !== agentId) return res.status(204).end();
    if (alreadyDelivered(call.call_id)) return res.status(204).end();

    const recado = buildRecado(call, { timezone });
    if (!recado.worthSending) {
      console.log(`[${call.call_id}] skipped: no content`);
      return res.status(204).end();
    }

    const sent = await notify(recado);
    if (sent.length === 0) {
      // Nothing reached the team: let Retell retry.
      return res.status(502).end();
    }
    delivered.set(call.call_id, Date.now());
    console.log(`[${call.call_id}] delivered via ${sent.join(", ")}${recado.urgent ? " (URGENT)" : ""}`);
    res.status(204).end();
  });

  return app;
}
