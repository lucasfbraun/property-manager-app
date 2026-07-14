import { test } from "node:test";
import assert from "node:assert/strict";
import {
  daysInMonth,
  formatReference,
  resolveBillingCycleDueDate,
} from "../app/lib/billing-cycle.ts";

test("daysInMonth cobre meses de 28/29/30/31 dias", () => {
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29); // bissexto
  assert.equal(daysInMonth(2026, 4), 30);
  assert.equal(daysInMonth(2026, 7), 31);
});

test("vencimento no mes corrente, antes do dia", () => {
  const r = resolveBillingCycleDueDate(15, "2026-07-13");
  assert.equal(r.dueDateIso, "2026-07-15");
  assert.equal(r.daysUntilDue, 2);
});

test("vencimento recem-passado continua no mes corrente (janela de atraso)", () => {
  const r = resolveBillingCycleDueDate(10, "2026-07-13");
  assert.equal(r.dueDateIso, "2026-07-10");
  assert.equal(r.daysUntilDue, -3);
});

test("vencimento passado ha mais de 10 dias rola para o mes seguinte", () => {
  const r = resolveBillingCycleDueDate(1, "2026-07-13");
  assert.equal(r.dueDateIso, "2026-08-01");
  assert.equal(r.daysUntilDue, 19);
});

test("dia 31 e ajustado para o ultimo dia do mes curto", () => {
  const r = resolveBillingCycleDueDate(31, "2026-02-10");
  assert.equal(r.dueDateIso, "2026-02-28");
});

test("rolagem de dezembro para janeiro troca o ano", () => {
  const r = resolveBillingCycleDueDate(1, "2026-12-20");
  assert.equal(r.dueDateIso, "2027-01-01");
});

test("formatReference gera Mes/Ano em pt-BR", () => {
  assert.equal(formatReference("2026-07-15"), "Julho/2026");
  assert.equal(formatReference("2026-01-05"), "Janeiro/2026");
});
