// Turns a Retell `call` object into the recado the team receives.
//
// Two sources, because not every call reaches the extraction node:
// - call.collected_dynamic_variables: fields from the flow's "Buzon inteligente" node.
//   Normal calls pass through it; urgent calls do not (urgencia -> transfer).
// - call.call_analysis.custom_analysis_data: the agent's post-call analysis, which runs
//   on every call. Used for the urgency flag and as the fallback summary.

const FIELDS = [
  ["nombre", "Nombre"],
  ["telefono", "Teléfono"],
  ["paciente", "Para quién"],
  ["tipo_interlocutor", "Quién llama"],
  ["motivo", "Motivo"],
  ["servicio_consultado", "Servicio consultado"],
  ["busca_profesional", "Busca"],
  ["modalidad", "Modalidad"],
  ["disponibilidad", "Disponibilidad"],
  ["mejor_momento", "Mejor momento para llamar"],
  ["preferencias", "Preferencias"],
  ["primera_vez", "Primera vez"],
  ["objecion", "Objeción o duda"],
  ["accion_solicitada", "Acción solicitada"],
  ["motivo_cancelacion", "Motivo de cancelación"],
  ["datos_pericial", "Datos pericial"],
  ["urgencia_percibida", "Urgencia percibida"],
  ["prioridad_organizativa", "Prioridad"],
];

// Enum values that read badly after the generic underscore-to-space conversion.
const LABELS = {
  primera_cita: "Primera cita",
  cambio_cancelacion: "Cambio o cancelación",
  informacion: "Información",
  orientacion: "Orientación",
  pericial: "Informe pericial",
  urgencia: "Urgencia",
  paciente_nuevo: "Paciente nuevo",
  paciente_existente: "Paciente del centro",
  profesional_sanitario: "Profesional sanitario",
  colegio_empresa: "Colegio o empresa",
  psicologia: "Psicología",
  psiquiatria: "Psiquiatría",
  infanto_juvenil: "Infanto juvenil",
  neuropsicologia: "Neuropsicología",
  terapia_grupal: "Terapia grupal",
  ginecologia: "Ginecología",
  medicina_estetica: "Medicina estética",
  medicina_general: "Medicina general",
  servicio_en_desarrollo: "Servicio en desarrollo",
  no_sabe: "No lo sabe",
  ubicacion: "Ubicación",
  dudas_tratamiento: "Dudas sobre el tratamiento",
  medicacion: "Medicación",
  experiencia_previa: "Experiencia previa",
  necesita_pensarlo: "Necesita pensarlo",
  quiere_hablar_persona: "Quiere hablar con una persona",
  requiere_revision_humana: "Requiere revisión humana",
  no_indicado: "No indicado",
  informativa: "Informativa",
  cita_solicitada: "Cita solicitada",
  contacto_humano_solicitado: "Pide que le llamen",
  valoracion_presupuesto_solicitado: "Pide valoración o presupuesto",
  informacion_resuelta: "Información resuelta",
  interesado_no_convertido: "Interesado, sin cita",
  servicio_no_disponible: "Servicio no disponible",
  conversacion_interrumpida: "Llamada interrumpida",
  derivacion_seguridad: "Protocolo de urgencia",
};

const EMPTY = new Set(["", "null", "undefined", "none", "n/a", "ninguna", "no_indicado", "desconocido"]);

export function label(value) {
  if (value === true) return "Sí";
  if (value === false) return "No";
  const v = String(value).trim();
  if (LABELS[v]) return LABELS[v];
  if (/^[a-z]+(_[a-z]+)*$/.test(v)) {
    const words = v.replace(/_/g, " ");
    return words[0].toUpperCase() + words.slice(1);
  }
  return v;
}

const present = (v) => v !== undefined && v !== null && !EMPTY.has(String(v).trim().toLowerCase());

export function buildRecado(call, { timezone = "Europe/Madrid" } = {}) {
  const vars = call.collected_dynamic_variables || {};
  const analysis = call.call_analysis?.custom_analysis_data || {};

  const urgent =
    analysis.urgencia_activada === true ||
    String(analysis.urgencia_activada).toLowerCase() === "true" ||
    vars.urgencia_percibida === "riesgo" ||
    vars.tipo_gestion === "urgencia" ||
    analysis.tipo_gestion === "urgencia" ||
    vars.resultado_llamada === "derivacion_seguridad" ||
    analysis.resultado_llamada === "derivacion_seguridad";

  const fields = FIELDS
    .filter(([key]) => present(vars[key]))
    .map(([key, name]) => [name, label(vars[key])]);

  // The caller ID is the fallback when the person never gave a number.
  if (!present(vars.telefono) && present(call.from_number)) {
    fields.splice(present(vars.nombre) ? 1 : 0, 0, ["Teléfono (de la llamada)", call.from_number]);
  }

  const gestion = vars.tipo_gestion || analysis.tipo_gestion;
  const resultado = vars.resultado_llamada || analysis.resultado_llamada;
  const summary = present(analysis.resumen_recado) ? String(analysis.resumen_recado).trim() : null;

  const hasUserTurn = /(^|\n)\s*User:/i.test(call.transcript || "");
  const hasData = present(vars.nombre) || present(vars.telefono) || present(vars.motivo);

  return {
    callId: call.call_id,
    urgent,
    gestion: present(gestion) ? label(gestion) : null,
    resultado: present(resultado) ? label(resultado) : null,
    fields,
    // Extracted fields are the reliable recado. The summary is only shown when they're
    // missing, which is always the case for urgent calls.
    summary: fields.length > 1 ? null : summary,
    callerNumber: call.from_number || null,
    when: formatWhen(call.start_timestamp, timezone),
    durationSec: call.start_timestamp && call.end_timestamp
      ? Math.round((call.end_timestamp - call.start_timestamp) / 1000) : null,
    callType: call.call_type || null,
    // Hang-ups before the caller said anything produce nothing worth sending.
    worthSending: urgent || hasData || (hasUserTurn && Boolean(summary)),
  };
}

function formatWhen(ms, timezone) {
  if (!ms) return null;
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone, weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(ms));
}
