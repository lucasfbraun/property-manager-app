/**
 * Datas do ciclo de cobranca — modulo PURO (sem imports de Workers/DB) para
 * poder ser testado com `npm test` (tests/billing-cycle.test.ts). Usado por
 * charge-scheduler.ts (cron diario) e reminders.ts.
 */

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Data de "hoje" (YYYY-MM-DD) no fuso America/Sao_Paulo. */
export function todayInSaoPaulo(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  });
  return formatter.format(new Date());
}

export function daysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

/**
 * Encontra o vencimento do ciclo corrente: a ocorrencia de `dueDay` neste
 * mes, ou no mes seguinte se a deste mes ja passou ha mais de ~10 dias
 * (para o cron diario nao mirar eternamente numa data antiga). `dueDay`
 * maior que o ultimo dia do mes e ajustado para o ultimo dia (ex.: 31 -> 28
 * em fevereiro).
 */
export function resolveBillingCycleDueDate(
  dueDay: number,
  todayIso: string,
): { dueDateIso: string; daysUntilDue: number } {
  const [year, month] = todayIso.split("-").map(Number);
  const day = Math.min(dueDay, daysInMonth(year, month));
  const candidateIso = `${year}-${pad2(month)}-${pad2(day)}`;

  const candidateDate = new Date(`${candidateIso}T12:00:00-03:00`);
  const todayDate = new Date(`${todayIso}T12:00:00-03:00`);
  const diffDays = Math.round((candidateDate.getTime() - todayDate.getTime()) / 86_400_000);

  if (diffDays < -10) {
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const nextDay = Math.min(dueDay, daysInMonth(nextYear, nextMonth));
    const nextIso = `${nextYear}-${pad2(nextMonth)}-${pad2(nextDay)}`;
    const nextDate = new Date(`${nextIso}T12:00:00-03:00`);
    const nextDiff = Math.round((nextDate.getTime() - todayDate.getTime()) / 86_400_000);
    return { daysUntilDue: nextDiff, dueDateIso: nextIso };
  }

  return { daysUntilDue: diffDays, dueDateIso: candidateIso };
}

/** Referencia legivel do ciclo, ex. "Julho/2026". */
export function formatReference(dueDateIso: string): string {
  const date = new Date(`${dueDateIso}T12:00:00-03:00`);
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).format(date);
  const [monthName, , year] = formatted.split(" ");
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${capitalized}/${year}`;
}
