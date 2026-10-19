import nodemailer from "nodemailer";
import { config } from "./config.js";
import { toEmail, toTelegram } from "./format.js";

// Retell gives up on a webhook after 10 s, so every send has to finish well before that.
const SEND_TIMEOUT_MS = 7000;

let transporter = null;
function mailer() {
  if (!transporter) {
    const e = config.email;
    transporter = nodemailer.createTransport({
      host: e.host,
      port: e.port,
      secure: e.secure === "ssl",
      requireTLS: e.secure === "starttls",
      ignoreTLS: e.secure === "none",
      auth: { user: e.user, pass: e.pass },
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
    });
  }
  return transporter;
}

async function sendTelegram(recado) {
  const text = toTelegram(recado);
  if (config.dryRun.includes("telegram")) return console.log("[dry-run telegram]\n" + text);

  const res = await fetch(`https://api.telegram.org/bot${config.telegram.token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: config.telegram.chatId, text, parse_mode: "HTML",
                           disable_web_page_preview: true }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(`Telegram ${res.status}: ${body.description || "error"}`);
}

async function sendEmail(recado) {
  const { subject, text, html } = toEmail(recado);
  if (config.dryRun.includes("email")) {
    return console.log(`[dry-run email] to=${config.email.to.join(",")} subject=${subject}\n${text}`);
  }
  await mailer().sendMail({ from: config.email.from, to: config.email.to, subject, text, html });
}

/** Sends to every configured channel. Returns the names of the channels that succeeded. */
export async function notify(recado) {
  const channels = [];
  if (config.telegram) channels.push(["telegram", sendTelegram]);
  if (config.email) channels.push(["email", sendEmail]);

  const results = await Promise.allSettled(channels.map(([, send]) => send(recado)));
  const sent = [];
  results.forEach((r, i) => {
    const name = channels[i][0];
    if (r.status === "fulfilled") sent.push(name);
    else console.error(`[${recado.callId}] ${name} failed: ${r.reason?.message || r.reason}`);
  });
  return sent;
}
