/**
 * Logica financeira PURA (sem imports de Workers/DB) para poder ser testada
 * com `npm test` (tests/finance.test.ts). Usada por mercadopago.ts (valor
 * devido com multa/juros) e rateios.ts (divisao proporcional em centavos).
 */

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export type AmountDueInput = {
  originalAmount: number;
  /** YYYY-MM-DD (vencimento, interpretado ao meio-dia de Sao Paulo). */
  dueDate: string;
  /** "paid" devolve o valor original sem encargos. */
  status: string;
  graceDays: number;
  /** Multa como fracao (0.02 = 2%). */
  fineRate: number;
  /** Juros ao mes como fracao (0.01 = 1% a.m., pro rata dia sobre 30). */
  monthlyInterestRate: number;
};

/**
 * Valor devido de uma cobranca em `now`: original + multa fixa + juros
 * simples pro rata dia, cobrados apenas apos os dias de carencia.
 */
export function computeAmountDue(input: AmountDueInput, now: Date = new Date()): number {
  if (input.status === "paid") {
    return input.originalAmount;
  }
  const due = new Date(`${input.dueDate}T12:00:00-03:00`);
  const rawDaysLate = Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86_400_000));
  const billableDaysLate = Math.max(0, rawDaysLate - input.graceDays);
  if (billableDaysLate <= 0) {
    return input.originalAmount;
  }
  const fine = input.originalAmount * input.fineRate;
  const interest =
    input.originalAmount * (input.monthlyInterestRate / 30) * billableDaysLate;
  return input.originalAmount + fine + interest;
}

/**
 * Divide `totalAmount` entre `weights` (um peso nao negativo por chave),
 * proporcionalmente. Arredonda cada parcela para centavos e joga o residuo
 * de arredondamento na ultima entrada, garantindo que a soma feche exata.
 * Pesos todos zero caem em divisao igualitaria.
 */
export function splitByWeights(
  totalAmount: number,
  weights: Array<{ key: string; weight: number }>,
): Map<string, number> {
  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0) || weights.length;
  const shares = new Map<string, number>();
  let allocated = 0;

  weights.forEach((item, index) => {
    const isLast = index === weights.length - 1;
    if (isLast) {
      shares.set(item.key, roundCents(totalAmount - allocated));
      return;
    }
    const share = roundCents((totalAmount * item.weight) / totalWeight);
    shares.set(item.key, share);
    allocated += share;
  });

  return shares;
}
