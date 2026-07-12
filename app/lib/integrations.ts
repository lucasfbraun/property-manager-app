import { env } from "cloudflare:workers";

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
  propertyName?: string;
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

  if (message.event === "contract_expiring") {
    const propertyText = message.propertyName ? ` do imovel ${message.propertyName}` : "";
    return `Ola, ${message.tenantName}. Seu contrato de locacao${propertyText} vence em ${message.dueDate}. Entre em contato para tratar da renovacao.`;
  }

  return `Ola, ${message.tenantName}. Lembrete do aluguel com vencimento em ${message.dueDate}, valor ${formattedAmount}. Link para pagamento: ${message.paymentUrl}`;
}

function getWahaCredentials(): { baseUrl: string; apiKey: string; session: string } {
  const config = env as Record<string, unknown>;
  const baseUrl = config[whatsappAutomationConfig.wahaBaseUrlEnv] as string | undefined;
  const apiKey = config[whatsappAutomationConfig.wahaApiKeyEnv] as string | undefined;
  const session =
    (config[whatsappAutomationConfig.wahaSessionEnv] as string | undefined) ??
    whatsappAutomationConfig.defaultSession;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Integracao WhatsApp nao configurada: defina WAHA_BASE_URL e WAHA_API_KEY na Cloudflare (wrangler.jsonc / wrangler secret put).",
    );
  }

  return { apiKey, baseUrl: baseUrl.replace(/\/$/, ""), session };
}

/**
 * Sends a WhatsApp reminder straight to WAHA (direct HTTP call, no
 * orchestrator in between — see app/lib/reminders.ts for who calls this and
 * app/lib/charge-scheduler.ts / worker/index.ts for the daily Cron Trigger
 * sweep).
 */
export async function sendPaymentReminder(
  message: WhatsAppReminder,
): Promise<void> {
  const { apiKey, baseUrl, session } = getWahaCredentials();
  const text = buildReminderText(message);
  const payload = buildWahaTextPayload({ session, tenantPhone: message.tenantPhone, text });

  const response = await fetch(`${baseUrl}${whatsappAutomationConfig.wahaSendTextEndpoint}`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Falha ao enviar WhatsApp via WAHA (status ${response.status}): ${body}`);
  }
}
