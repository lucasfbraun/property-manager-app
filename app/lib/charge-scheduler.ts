import { getD1 } from "../../db";
import { ensureRentalDatabase } from "./rental-repository";
import { applyPendingRateioAllocations } from "./rateios";

type ActiveContractRow = {
  id: string;
  property_id: string;
  receiver_id: string;
  monthly_rent: number;
  due_day: number;
  status: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function todayInSaoPaulo(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  });
  return formatter.format(new Date());
}

function daysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

/**
 * Finds the due date for the contract's current billing cycle: this
 * month's occurrence of `dueDay`, or next month's if this month's already
 * happened more than ~10 days ago (so a daily cron doesn't keep targeting a
 * date that's long gone).
 */
function resolveBillingCycleDueDate(
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

/** How many days before the due date the charge/Pix becomes available. */
const GENERATE_LEAD_DAYS = 5;
/** Small catch-up window in case a cron run is missed for a few days. */
const GENERATE_CATCHUP_DAYS = -3;

async function chargeExists(contractId: string, reference: string): Promise<boolean> {
  const d1 = getD1();
  const row = await d1
    .prepare("SELECT id FROM charges WHERE contract_id = ? AND reference = ? LIMIT 1")
    .bind(contractId, reference)
    .first<{ id: string }>();
  return Boolean(row);
}

async function insertCharge(input: {
  contractId: string;
  receiverId: string;
  amount: number;
  dueDateIso: string;
  reference: string;
}): Promise<string> {
  const d1 = getD1();
  const id = `chg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await d1
    .prepare(
      `INSERT INTO charges (id, contract_id, receiver_id, reference, due_date, original_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`,
    )
    .bind(id, input.contractId, input.receiverId, input.reference, input.dueDateIso, input.amount)
    .run();
  return id;
}

/**
 * Manually (or on-demand) generates the current billing cycle's charge for
 * one contract. If a charge for this reference already exists and hasn't
 * been paid yet, its amount is refreshed to the contract's current
 * monthly_rent instead of silently no-op'ing — covers the case where the
 * rent was edited after the charge had already been generated.
 */
export async function generateChargeForContract(contractId: string): Promise<{
  created: boolean;
  updated: boolean;
  chargeId?: string;
  reference: string;
}> {
  await ensureRentalDatabase();
  const d1 = getD1();
  const contract = await d1
    .prepare(
      "SELECT id, property_id, receiver_id, monthly_rent, due_day, status FROM contracts WHERE id = ?",
    )
    .bind(contractId)
    .first<ActiveContractRow>();

  if (!contract) {
    throw new Error("Contrato nao encontrado.");
  }

  const today = todayInSaoPaulo();
  const { dueDateIso } = resolveBillingCycleDueDate(contract.due_day, today);
  const reference = formatReference(dueDateIso);

  const existing = await d1
    .prepare("SELECT id, status FROM charges WHERE contract_id = ? AND reference = ? LIMIT 1")
    .bind(contractId, reference)
    .first<{ id: string; status: string }>();

  if (existing) {
    if (existing.status === "paid") {
      return { created: false, reference, updated: false };
    }

    // Also refresh the due date (in case due_day changed since this charge
    // was generated) and wipe any already-generated Pix QR code: it was
    // created at Mercado Pago with the old amount baked in, so it must be
    // regenerated once the charge's amount changes (see updateContract in
    // rental-repository.ts for the same rule).
    await d1
      .prepare(
        `UPDATE charges SET
          original_amount = ? + COALESCE(rateio_amount, 0),
          due_date = ?,
          mercado_pago_payment_id = NULL,
          payment_url = NULL,
          pix_qr_code = NULL,
          pix_qr_code_base64 = NULL,
          pix_expires_at = NULL
         WHERE id = ?`,
      )
      .bind(contract.monthly_rent, dueDateIso, existing.id)
      .run();

    return { chargeId: existing.id, created: false, reference, updated: true };
  }

  const chargeId = await insertCharge({
    amount: contract.monthly_rent,
    contractId,
    dueDateIso,
    receiverId: contract.receiver_id,
    reference,
  });

  // Folds in any rateio share that was recorded for this property/month
  // before the charge existed (see app/lib/rateios.ts).
  await applyPendingRateioAllocations(contract.property_id, reference, chargeId);

  return { chargeId, created: true, reference, updated: false };
}

/**
 * Runs once a day (Cloudflare Cron Trigger): for every active/expiring
 * contract, generates the current cycle's charge once it's within the lead
 * window before the due date, if it doesn't already exist.
 */
export async function runMonthlyChargeSweep(): Promise<{ created: number; skipped: number }> {
  await ensureRentalDatabase();
  const d1 = getD1();
  const contracts = await d1
    .prepare(
      "SELECT id, property_id, receiver_id, monthly_rent, due_day, status FROM contracts WHERE status IN ('active', 'expiring')",
    )
    .all<ActiveContractRow>();

  const today = todayInSaoPaulo();
  let created = 0;
  let skipped = 0;

  for (const contract of contracts.results) {
    const { dueDateIso, daysUntilDue } = resolveBillingCycleDueDate(contract.due_day, today);

    if (daysUntilDue > GENERATE_LEAD_DAYS || daysUntilDue < GENERATE_CATCHUP_DAYS) {
      continue;
    }

    const reference = formatReference(dueDateIso);
    if (await chargeExists(contract.id, reference)) {
      skipped += 1;
      continue;
    }

    const chargeId = await insertCharge({
      amount: contract.monthly_rent,
      contractId: contract.id,
      dueDateIso,
      receiverId: contract.receiver_id,
      reference,
    });
    await applyPendingRateioAllocations(contract.property_id, reference, chargeId);
    created += 1;
  }

  return { created, skipped };
}
