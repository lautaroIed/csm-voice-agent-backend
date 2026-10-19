# csm-voice-agent-backend

Receives the Retell webhook after every call to the CSM voice agent and sends the
recado to the team on Telegram and by email.

```
Retell call ends ─► call_analyzed webhook ─► verify signature ─► build recado ─► Telegram + email
```

- Only `call_analyzed` is used. It's the event that carries the extracted data.
- Urgent calls (urgency protocol activated) are flagged `URGENTE` on both channels.
- Hang-ups where the caller said nothing are skipped.
- No database. Nothing is stored except the IDs of calls already delivered, kept in memory
  for 24 h so Retell's retries don't produce duplicate messages.

## Where the data comes from

| Source | Contains | Present on |
| --- | --- | --- |
| `call.collected_dynamic_variables` | Fields from the flow's *Buzón inteligente* node: nombre, teléfono, motivo, servicio, modalidad... | Normal calls |
| `call.call_analysis.custom_analysis_data` | Post-call analysis: `resumen_recado`, `urgencia_activada`, `tipo_gestion`, `resultado_llamada` | Every call |

Urgent calls go straight from the urgency node to the transfer and never reach the
extraction node. For those, the message uses the caller ID and the post-call summary.

## Setup

Requires Node 20 or later.

```bash
npm install
cp .env.example .env   # then fill in the values
npm test
npm start
```

| Variable | Notes |
| --- | --- |
| `RETELL_API_KEY` | Also used to verify webhook signatures |
| `RETELL_AGENT_ID` | Only this agent's calls are forwarded. Empty forwards all agents |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Bot `@csm_avisos_bot`. The chat ID is the group the bot was added to |
| `SMTP_*` | `SMTP_SECURE` is `starttls`, `ssl` or `none`. `SMTP_TO` takes a comma-separated list |
| `DRY_RUN` | `telegram`, `email` or both: logs the message instead of sending it |

At least one channel, Telegram or email, must be configured.

### Getting the Telegram chat ID

Add the bot to the group, then:

```bash
curl https://api.telegram.org/bot<TOKEN>/getUpdates
```

The group appears as `"chat":{"id":-100...,"title":"..."}`. The ID is negative.

## Deploy

### Netlify (current)

The webhook runs as a Netlify Function (`netlify/functions/`). `netlify.toml` publishes only
`public/`, so the source code is never served. Every push to `main` deploys.

Dedupe uses Netlify Blobs (store `delivered-calls`), because serverless instances don't share
memory.

### Any other Node host

`npm start` runs the same logic as an Express server, for example on a VPS behind Caddy or nginx.

### Steps

1. Deploy and set the environment variables. On Netlify: **Project configuration → Environment
   variables**, every variable from `.env.example` (`PORT` isn't needed).
2. Check `https://<host>/health` returns `{"ok":true}`.
3. In Retell, open the agent and set the **webhook URL** to `https://<host>/webhooks/retell`,
   or via the API:

   ```bash
   curl -X PATCH https://api.retellai.com/update-agent/<AGENT_ID> \
     -H "Authorization: Bearer <RETELL_API_KEY>" -H "Content-Type: application/json" \
     -d '{"webhook_url":"https://<host>/webhooks/retell","webhook_events":["call_analyzed"]}'
   ```

4. Make a web test call from the Retell dashboard. The message is marked as a test call.

If the host sits behind a firewall, Retell webhooks come from `100.20.5.228`.

## Behaviour

| Situation | Response |
| --- | --- |
| Missing or invalid signature, or older than 5 minutes | `401` |
| Any event other than `call_analyzed`, other agents, empty hang-ups | `204`, nothing sent |
| At least one channel delivered | `204` |
| Every channel failed | `502`, so Retell retries (up to 3 times) |

Each send has a 7 s timeout, because Retell abandons a webhook after 10 s.
