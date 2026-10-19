import { buildRecado } from "./recado.js";

const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;

/** Remembers delivered call IDs for 24 h. Good enough for one long-lived process. */
export function memoryStore() {
  const seen = new Map();
  return {
    async has(id) {
      const now = Date.now();
      for (const [k, t] of seen) if (now - t > DEDUPE_TTL_MS) seen.delete(k);
      return seen.has(id);
    },
    async add(id) { seen.set(id, Date.now()); },
  };
}

/**
 * Framework-agnostic Retell webhook handling. Returns the HTTP status to answer with.
 *
 * @param {object} deps
 * @param {(rawBody: string, signature: string) => Promise<boolean>} deps.verify
 * @param {(recado: object) => Promise<string[]>} deps.notify  channels that succeeded
 * @param {{has: (id: string) => Promise<boolean>, add: (id: string) => Promise<void>}} deps.store
 * @param {string|null} [deps.agentId]  only calls from this agent are forwarded
 * @param {string} [deps.timezone]
 */
export function createWebhookHandler({ verify, notify, store, agentId = null, timezone = "Europe/Madrid" }) {
  return async function handle(raw, signature) {
    // The signature covers the exact bytes Retell sent, so this must be the raw body.
    if (!signature || !(await verify(raw, signature).catch(() => false))) return 401;

    let event, call;
    try {
      ({ event, call } = JSON.parse(raw));
    } catch {
      return 400;
    }

    // call_started / call_ended carry no analysis yet; only call_analyzed has the recado.
    if (event !== "call_analyzed" || !call?.call_id) return 204;
    if (agentId && call.agent_id !== agentId) return 204;

    // Retell retries up to 3 times. Don't post the same recado twice.
    if (await store.has(call.call_id).catch(() => false)) return 204;

    const recado = buildRecado(call, { timezone });
    if (!recado.worthSending) {
      console.log(`[${call.call_id}] skipped: no content`);
      return 204;
    }

    const sent = await notify(recado);
    if (sent.length === 0) return 502; // nothing reached the team: let Retell retry

    await store.add(call.call_id).catch((e) => console.error(`[${call.call_id}] dedupe store: ${e.message}`));
    console.log(`[${call.call_id}] delivered via ${sent.join(", ")}${recado.urgent ? " (URGENT)" : ""}`);
    return 204;
  };
}
