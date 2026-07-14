import { env } from "cloudflare:workers";
import { getD1 } from "../../db";
import { getChargeReminderContext } from "./mercadopago";
import { sendPaymentReminder, type WhatsAppReminder } from "./integrations";
import { todayInSaoPaulo } from "./charge-scheduler";

/**
 * How many days before the due date the "before_due" reminder goes out, and
 * how often "after_due" repeats while still unpaid — per the cadence agreed
 * in docs/INTEGRACAO_WHATSAPP_WAHA.md (5 dias antes; atraso a cada 3 dias).
 */
const BEFORE_DUE_LEAD_DAYS = 5;
const AFTER_DUE_RESEND_DAYS = 3;

function getAppBaseUrl(): string {
  const config = env as unknown as Record<string, unknown>;
  const base = (config.APP_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
  return base;
}

function buildPaymentUrl(): string {
  return `${getAppBaseUrl()}/inquilino`;
}

function formatDatePtBr(dateIso: string): string {
  const date = new Date(`${dateIso}T12:00:00-03:00`);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(date);
}

function diffDaysFromToday(dueDateIso: string, todayIso: string): number {
  const due = new Date(`${dueDateIso}T12:00:00-03:00`);
  const today = new Date(`${todayIso}T12:00:00-03:00`);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

async function markReminderSent(chargeId: string, event: string): Promise<void> {
  const d1 = getD1();
  await d1
    .prepare("UPDATE charges SET last_reminder_event = ?, last_reminder_sent_at = ? WHERE id = ?")
    .bind(event, new Date().toISOString(), chargeId)
    .run();
}

function determineReminderEvent(context: {
  status: string;
  dueDateIso: string;
}): { event: WhatsAppReminder["event"]; daysLate?: number } {
  if (context.status === "paid") {
    return { event: "payment_confirmed" };
  }

  const diffDays = diffDaysFromToday(context.dueDateIso, todayInSaoPaulo());
  if (diffDays < 0) {
    return { daysLate: Math.abs(diffDays), event: "after_due" };
  }
  if (diffDays === 0) {
    return { event: "due_day" };
  }
  return { event: "before_due" };
}

/**
 * Sends whatever reminder currently makes sense for this charge (before due,
 * due today, overdue, or already paid) straight to the tenant's WhatsApp.
 * Used both by the manual admin button and by the automatic daily sweep.
 */
export async function sendChargeReminder(chargeId: string): Promise<{
  event: WhatsAppReminder["event"];
  tenantName: string;
}> {
  const context = await getChargeReminderContext(chargeId);
  if (!context) {
    throw new Error("Cobranca nao encontrada.");
  }
  if (!context.tenantPhone) {
    throw new Error("Este inquilino nao tem WhatsApp cadastrado.");
  }

  const { event, daysLate } = determineReminderEvent(context);

  const message: WhatsAppReminder = {
    amount: context.amountDue,
    chargeId: context.chargeId,
    daysLate,
    dueDate: formatDatePtBr(context.dueDateIso),
    event,
    paymentUrl: buildPaymentUrl(),
    propertyName: context.propertyName,
    receiverName: context.receiverName,
    tenantName: context.tenantName,
    tenantPhone: context.tenantPhone,
  };

  await sendPaymentReminder(message);
  await markReminderSent(context.chargeId, event);

  return { event, tenantName: context.tenantName };
}

/** Sent right when a payment is confirmed (webhook or manual "Verificar pagamento" fallback). */
export async function sendPaymentConfirmedReminder(chargeId: string): Promise<void> {
  const context = await getChargeReminderContext(chargeId);
  if (!context || !context.tenantPhone) {
    return;
  }

  const message: WhatsAppReminder = {
    amount: context.amountDue,
    chargeId: context.chargeId,
    dueDate: formatDatePtBr(context.dueDateIso),
    event: "payment_confirmed",
    paymentUrl: buildPaymentUrl(),
    propertyName: context.propertyName,
    receiverName: context.receiverName,
    tenantName: context.tenantName,
    tenantPhone: context.tenantPhone,
  };

  await sendPaymentReminder(message);
  await markReminderSent(context.chargeId, "payment_confirmed");
}

type ContractExpiringRow = {
  ends_at: string;
  expiring_reminder_sent_at: string | null;
  tenant_name: string;
  tenant_whatsapp: string;
  property_name: string;
};

/**
 * Sent once when a contract's status is set to "Vence em breve" (see
 * app/api/contracts/route.ts PATCH). Tracked via
 * contracts.expiring_reminder_sent_at so re-saving the same status doesn't
 * resend it.
 */
export async function sendContractExpiringReminder(contractId: string): Promise<boolean> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      `SELECT ct.ends_at as ends_at, ct.expiring_reminder_sent_at as expiring_reminder_sent_at,
              t.name as tenant_name, t.whatsapp as tenant_whatsapp, p.name as property_name
       FROM contracts ct
       JOIN tenants t ON t.id = ct.tenant_id
       JOIN properties p ON p.id = ct.property_id
       WHERE ct.id = ?`,
    )
    .bind(contractId)
    .first<ContractExpiringRow>();

  if (!row || row.expiring_reminder_sent_at || !row.tenant_whatsapp) {
    return false;
  }

  const message: WhatsAppReminder = {
    amount: 0,
    chargeId: contractId,
    dueDate: formatDatePtBr(row.ends_at),
    event: "contract_expiring",
    paymentUrl: buildPaymentUrl(),
    propertyName: row.property_name,
    tenantName: row.tenant_name,
    tenantPhone: row.tenant_whatsapp,
  };

  await sendPaymentReminder(message);
  await d1
    .prepare("UPDATE contracts SET expiring_reminder_sent_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), contractId)
    .run();
  return true;
}

type ReminderCandidateRow = {
  id: string;
  due_date: string;
  last_reminder_event: string | null;
  last_reminder_sent_at: string | null;
};

/**
 * Daily Cron Trigger sweep (see worker/index.ts): for every open/waiting
 * charge, sends the before_due / due_day / after_due reminder once it hits
 * the right day, skipping charges that already got that exact reminder
 * (after_due is the one exception — it re-nags every AFTER_DUE_RESEND_DAYS).
 */
export async function runReminderSweep(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const d1 = getD1();
  const rows = await d1
    .prepare(
      `SELECT id, due_date, last_reminder_event, last_reminder_sent_at
       FROM charges
       WHERE status IN ('open', 'waiting_payment')`,
    )
    .all<ReminderCandidateRow>();

  const today = todayInSaoPaulo();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows.results) {
    const diffDays = diffDaysFromToday(row.due_date, today);
    const desiredEvent: WhatsAppReminder["event"] | null =
      diffDays < 0
        ? "after_due"
        : diffDays === 0
          ? "due_day"
          : diffDays === BEFORE_DUE_LEAD_DAYS
            ? "before_due"
            : null;

    if (!desiredEvent) {
      skipped += 1;
      continue;
    }

    if (desiredEvent === row.last_reminder_event) {
      if (desiredEvent !== "after_due") {
        skipped += 1;
        continue;
      }
      const lastSentAt = row.last_reminder_sent_at ? new Date(row.last_reminder_sent_at).getTime() : 0;
      if (Date.now() - lastSentAt < AFTER_DUE_RESEND_DAYS * 86_400_000) {
        skipped += 1;
        continue;
      }
    }

    try {
      await sendChargeReminder(row.id);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`[reminders] falha ao enviar lembrete da cobranca ${row.id}:`, error);
    }
  }

  return { failed, sent, skipped };
}
