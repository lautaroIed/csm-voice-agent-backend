import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRecado } from "../src/recado.js";
import { toEmail, toTelegram } from "../src/format.js";
import { hangUpCall, normalCall, urgentCall } from "./fixtures.js";

const field = (r, name) => r.fields.find(([n]) => n === name)?.[1];

test("normal call: extracted fields, readable labels, no summary", () => {
  const r = buildRecado(normalCall);
  assert.equal(r.urgent, false);
  assert.equal(r.worthSending, true);
  assert.equal(r.gestion, "Primera cita");
  assert.equal(field(r, "Nombre"), "María López");
  assert.equal(field(r, "Servicio consultado"), "Psicología");
  assert.equal(field(r, "Objeción o duda"), undefined, "'ninguna' is not worth a line");
  assert.equal(r.summary, null);
  assert.match(r.when, /20 de octubre/);
});

test("urgent call: flagged, falls back to caller ID and post-call summary", () => {
  const r = buildRecado(urgentCall);
  assert.equal(r.urgent, true);
  assert.equal(r.worthSending, true);
  assert.equal(field(r, "Teléfono (de la llamada)"), "+34600999888");
  assert.match(r.summary, /112/);
  assert.match(toTelegram(r), /URGENTE/);
  assert.match(toEmail(r).subject, /^\[URGENTE\]/);
});

test("hang-up with nothing said is skipped", () => {
  assert.equal(buildRecado(hangUpCall).worthSending, false);
});

test("telegram output escapes HTML from caller-provided text", () => {
  const call = structuredClone(normalCall);
  call.collected_dynamic_variables.motivo = "<script> & dudas";
  const text = toTelegram(buildRecado(call));
  assert.match(text, /&lt;script&gt; &amp; dudas/);
  assert.doesNotMatch(text, /<script>/);
});

test("email subject carries no clinical detail", () => {
  const { subject } = toEmail(buildRecado(normalCall));
  assert.equal(subject, "[CSM] Nuevo recado · Primera cita · María López");
  assert.doesNotMatch(subject, /ansiedad/i);
});
