import { verify } from "retell-sdk";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { notify } from "./notify.js";

const app = createApp({
  verify: async (raw, signature) => Boolean(await verify(raw, config.retell.apiKey, signature)),
  notify,
  agentId: config.retell.agentId,
  timezone: config.timezone,
});

app.listen(config.port, () => {
  const channels = [config.telegram && "telegram", config.email && "email"].filter(Boolean);
  console.log(`csm-voice-agent-backend listening on :${config.port} (channels: ${channels.join(", ")}` +
    `${config.dryRun.length ? `, dry-run: ${config.dryRun.join(", ")}` : ""})`);
});
