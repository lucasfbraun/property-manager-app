import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAmountDue, roundCents, splitByWeights } from "../app/lib/finance.ts";

// Base: aluguel 1000, multa 2%, juros 1% a.m., vence 2026-07-10.
const base = {
  dueDate: "2026-07-10",
  fineRate: 0.02,
  graceDays: 0,
  monthlyInterestRate: 0.01,
  originalAmount: 1000,
  status: "open",
};

function at(iso: string): Date {
  return new Date(iso);
}

test("em dia: sem multa nem juros", () => {
  assert.equal(computeAmountDue(base, at("2026-07-10T12:00:00-03:00")), 1000);
  assert.equal(computeAmountDue(base, at("2026-07-01T12:00:00-03:00")), 1000);
});

test("cobranca paga nunca recebe encargos, mesmo atrasada", () => {
  const paid = { ...base, status: "paid" };
  assert.equal(computeAmountDue(paid, at("2026-09-01T12:00:00-03:00")), 1000);
});

test("1 dia de atraso: multa fixa + 1 dia de juros pro rata", () => {
  const value = computeAmountDue(base, at("2026-07-11T12:00:00-03:00"));
  // 1000 + 20 (multa 2%) + 1000 * (0.01/30) * 1
  assert.equal(roundCents(value), roundCents(1000 + 20 + 1000 * (0.01 / 30)));
});

test("30 dias de atraso: juros de um mes cheio", () => {
  const value = computeAmountDue(base, at("2026-08-09T12:00:00-03:00"));
  // 1000 + 20 + 10 (1% a.m. * 30/30)
  assert.equal(roundCents(value), 1030);
});

test("carencia absorve os primeiros dias de atraso", () => {
  const withGrace = { ...base, graceDays: 5 };
  // 3 dias de atraso, dentro da carencia: sem encargos
  assert.equal(computeAmountDue(withGrace, at("2026-07-13T12:00:00-03:00")), 1000);
  // 6 dias de atraso: cobra multa + 1 dia de juros (6 - 5)
  const value = computeAmountDue(withGrace, at("2026-07-16T12:00:00-03:00"));
  assert.equal(roundCents(value), roundCents(1000 + 20 + 1000 * (0.01 / 30)));
});

test("horas antes do vencimento nao contam como atraso", () => {
  // vencimento ao meio-dia -03:00; 23h do mesmo dia ainda e "em dia"
  assert.equal(computeAmountDue(base, at("2026-07-10T23:00:00-03:00")), 1000);
});

test("splitByWeights: soma das parcelas fecha exatamente no total", () => {
  const shares = splitByWeights(100, [
    { key: "a", weight: 1 },
    { key: "b", weight: 1 },
    { key: "c", weight: 1 },
  ]);
  const total = [...shares.values()].reduce((sum, v) => sum + v, 0);
  assert.equal(roundCents(total), 100);
  // residuo de arredondamento cai na ultima chave
  assert.equal(shares.get("a"), 33.33);
  assert.equal(shares.get("b"), 33.33);
  assert.equal(shares.get("c"), 33.34);
});

test("splitByWeights: proporcional ao peso (moradores)", () => {
  const shares = splitByWeights(300, [
    { key: "casa1", weight: 2 },
    { key: "casa2", weight: 4 },
  ]);
  assert.equal(shares.get("casa1"), 100);
  assert.equal(shares.get("casa2"), 200);
});

test("splitByWeights: pesos todos zero caem em divisao igual", () => {
  const shares = splitByWeights(90, [
    { key: "a", weight: 0 },
    { key: "b", weight: 0 },
    { key: "c", weight: 0 },
  ]);
  assert.equal(shares.get("a"), 0);
  assert.equal(shares.get("b"), 0);
  assert.equal(shares.get("c"), 90);
});
