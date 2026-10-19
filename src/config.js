const env = process.env;

const list = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);

function required(name) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

const smtpSecure = (env.SMTP_SECURE || "starttls").toLowerCase();
if (!["starttls", "ssl", "none"].includes(smtpSecure)) {
  throw new Error("SMTP_SECURE must be starttls, ssl or none");
}

export const config = {
  port: Number(env.PORT) || 3000,
  timezone: env.TIMEZONE || "Europe/Madrid",
  // Comma separated: telegram, email. Any channel listed here is logged instead of sent.
  dryRun: list(env.DRY_RUN),

  retell: {
    apiKey: required("RETELL_API_KEY"),
    // Only notify for calls from this agent. Other agents on the account are ignored.
    agentId: env.RETELL_AGENT_ID || null,
  },

  telegram: env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID
    ? { token: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID }
    : null,

  email: env.SMTP_HOST
    ? {
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT) || (smtpSecure === "ssl" ? 465 : 587),
        secure: smtpSecure,
        user: required("SMTP_USER"),
        pass: required("SMTP_PASS"),
        from: env.SMTP_FROM || env.SMTP_USER,
        to: list(required("SMTP_TO")),
      }
    : null,
};

if (!config.telegram && !config.email) {
  throw new Error("Configure at least one channel: TELEGRAM_* or SMTP_*");
}
