// Shaped like Retell's call_analyzed payload for this agent's flow.

export const AGENT_ID = "agent_test";

export const normalCall = {
  call_id: "call_normal_1",
  agent_id: AGENT_ID,
  call_type: "phone_call",
  from_number: "+34600111222",
  start_timestamp: Date.UTC(2026, 9, 20, 18, 30),
  end_timestamp: Date.UTC(2026, 9, 20, 18, 33, 12),
  transcript: "Agent: Centro de Salud Mental, buenas tardes.\nUser: Quería pedir cita para psicología.",
  collected_dynamic_variables: {
    current_node: "Cierre",
    nombre: "María López",
    telefono: "600123456",
    paciente: "Para ella misma",
    tipo_gestion: "primera_cita",
    motivo: "Ansiedad y dificultades para dormir desde hace tres meses",
    servicio_consultado: "psicologia",
    modalidad: "online",
    disponibilidad: "Lunes y miércoles por la tarde",
    mejor_momento: "Entre 15:00 y 17:00",
    objecion: "ninguna",
    urgencia_percibida: "normal",
    prioridad_organizativa: "alta",
    resultado_llamada: "cita_solicitada",
  },
  call_analysis: {
    custom_analysis_data: {
      resumen_recado: "Nombre: María López / Teléfono: 600123456 / Motivo: ansiedad",
      urgencia_activada: false,
      tipo_gestion: "primera_cita",
      resultado_llamada: "cita_solicitada",
    },
  },
};

// Urgent calls go urgencia -> transfer and never reach the extraction node.
export const urgentCall = {
  call_id: "call_urgent_1",
  agent_id: AGENT_ID,
  call_type: "phone_call",
  from_number: "+34600999888",
  start_timestamp: Date.UTC(2026, 9, 20, 22, 5),
  end_timestamp: Date.UTC(2026, 9, 20, 22, 9),
  transcript: "Agent: Centro de Salud Mental, buenas noches.\nUser: No puedo más, quiero hacerme daño.",
  collected_dynamic_variables: { current_node: "Cierre urgencia" },
  call_analysis: {
    custom_analysis_data: {
      resumen_recado: "Persona que expresa ideas de hacerse daño. Se le dio el 112 y el 024. Transferencia sin respuesta.",
      urgencia_activada: true,
      tipo_gestion: "urgencia",
      resultado_llamada: "derivacion_seguridad",
    },
  },
};

export const hangUpCall = {
  call_id: "call_hangup_1",
  agent_id: AGENT_ID,
  call_type: "phone_call",
  from_number: "+34600555444",
  transcript: "Agent: Centro de Salud Mental, buenas tardes.",
  collected_dynamic_variables: { current_node: "Acogida" },
  call_analysis: { custom_analysis_data: { urgencia_activada: false } },
};
