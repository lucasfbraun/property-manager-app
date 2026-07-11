export type MercadoPagoReceiverMode =
  | "central_account"
  | "multiple_accounts"
  | "oauth_connected_accounts"
  | "marketplace_split";

export type PaymentRequest = {
  chargeId: string;
  receiverId: string;
  amount: number;
  description: string;
  payerEmail: string;
};

export type PaymentLink = {
  externalId: string;
  checkoutUrl: string;
  qrCodeText?: string;
};

export async function createPixCharge(
  request: PaymentRequest,
): Promise<PaymentLink> {
  void request;
  throw new Error(
    "Integracao Mercado Pago pendente: definir modelo de recebimento antes de criar cobrancas reais.",
  );
}

export type WhatsAppReminder = {
  chargeId: string;
  event:
    | "before_due"
    | "due_day"
    | "after_due"
    | "payment_confirmed"
    | "contract_expiring";
  tenantName: string;
  tenantPhone: string;
  amount: number;
  dueDate: string;
  paymentUrl: string;
  daysLate?: number;
  receiverName?: string;
};

export type WahaTextMessagePayload = {
  session: string;
  chatId: string;
  text: string;
};

/**
 * Direct integration: a Cloudflare Cron Trigger (same mechanism as the
 * monthly charge sweep, see app/lib/charge-scheduler.ts) calls WAHA's HTTP
 * API straight from the Worker. No orchestrator (n8n) in between.
 */
export const whatsappAutomationConfig = {
  provider: "WAHA",
  trigger: "cloudflare-cron",
  wahaBaseUrlEnv: "WAHA_BASE_URL",
  wahaApiKeyEnv: "WAHA_API_KEY",
  wahaSessionEnv: "WAHA_SESSION",
  wahaSendTextEndpoint: "/api/sendText",
  defaultSession: "default",
} as const;

export function normalizeBrazilianPhoneToWahaChatId(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@c.us`;
}

export function buildWahaTextPayload({
  session = whatsappAutomationConfig.defaultSession,
  text,
  tenantPhone,
}: {
  session?: string;
  tenantPhone: string;
  text: string;
}): WahaTextMessagePayload {
  return {
    chatId: normalizeBrazilianPhoneToWahaChatId(tenantPhone),
    session,
    text,
  };
}

export function buildReminderText(message: WhatsAppReminder) {
  const formattedAmount = new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(message.amount);

  if (message.event === "payment_confirmed") {
    return `Ola, ${message.tenantName}. Seu pagamento de ${formattedAmount} foi confirmado. Obrigado!`;
  }

  if (message.event === "after_due") {
    return `Ola, ${message.tenantName}. Identificamos aluguel em atraso no valor atualizado de ${formattedAmount}. Acesse o link para pagamento: ${message.paymentUrl}`;
  }

  return `Ola, ${message.tenantName}. Lembrete do aluguel com vencimento em ${message.dueDate}, valor ${formattedAmount}. Link para pagamento: ${message.paymentUrl}`;
}

/**
 * Sends a WhatsApp reminder straight to WAHA. Called from the Cron Trigger
 * sweep (see docs/INTEGRACAO_WHATSAPP_WAHA.md), not yet wired up: pending the
 * sweep function itself and the WAHA_* secrets in Cloudflare.
 */
export async function sendPaymentReminder(
  message: WhatsAppReminder,
): Promise<void> {
  void message;
  throw new Error(
    "Integracao WhatsApp pendente: configurar WAHA_BASE_URL/WAHA_API_KEY e implementar o disparo via Cron Trigger.",
  );
}
