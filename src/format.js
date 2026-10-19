const TELEGRAM_LIMIT = 4096;

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function title(r) {
  if (r.urgent) return "URGENTE · Protocolo de urgencia activado";
  return r.gestion ? `Nuevo recado · ${r.gestion}` : "Nuevo recado";
}

function footer(r) {
  return [
    r.when && `Llamada: ${r.when}${r.durationSec != null ? ` (${r.durationSec} s)` : ""}`,
    r.resultado && `Resultado: ${r.resultado}`,
    r.callType === "web_call" && "Llamada de prueba desde el panel de Retell",
    `ID: ${r.callId}`,
  ].filter(Boolean);
}

export function toTelegram(r) {
  const lines = [`<b>${r.urgent ? "🚨 " : ""}${escapeHtml(title(r))}</b>`, ""];
  if (r.urgent) {
    lines.push("El asistente activó el protocolo de urgencia. Revisar el caso cuanto antes.", "");
  }
  for (const [name, value] of r.fields) lines.push(`<b>${escapeHtml(name)}:</b> ${escapeHtml(value)}`);
  if (r.summary) lines.push("", `<b>Resumen:</b>`, escapeHtml(r.summary));
  lines.push("", ...footer(r).map((l) => `<i>${escapeHtml(l)}</i>`));

  const text = lines.join("\n");
  return text.length <= TELEGRAM_LIMIT ? text : text.slice(0, TELEGRAM_LIMIT - 20) + "\n… (recortado)";
}

export function toEmail(r) {
  // The subject shows up in phone notifications: no clinical detail in it.
  const who = r.fields.find(([n]) => n === "Nombre")?.[1];
  const subject = r.urgent
    ? `[URGENTE] [CSM] Protocolo de urgencia activado`
    : `[CSM] ${title(r)}${who ? ` · ${who}` : ""}`;

  const text = [
    title(r),
    "",
    ...(r.urgent ? ["El asistente activó el protocolo de urgencia. Revisar el caso cuanto antes.", ""] : []),
    ...r.fields.map(([n, v]) => `${n}: ${v}`),
    ...(r.summary ? ["", "Resumen:", r.summary] : []),
    "",
    ...footer(r),
  ].join("\n");

  const rows = r.fields
    .map(([n, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top"><b>${escapeHtml(n)}</b></td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`)
    .join("");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
<h2 style="margin:0 0 12px;color:${r.urgent ? "#b00020" : "#222"}">${escapeHtml(title(r))}</h2>
${r.urgent ? `<p style="color:#b00020"><b>El asistente activó el protocolo de urgencia. Revisar el caso cuanto antes.</b></p>` : ""}
<table style="border-collapse:collapse">${rows}</table>
${r.summary ? `<p><b>Resumen:</b><br>${escapeHtml(r.summary).replace(/\n/g, "<br>")}</p>` : ""}
<p style="color:#888;font-size:12px">${footer(r).map(escapeHtml).join("<br>")}</p>
</div>`;

  return { subject, text, html };
}
