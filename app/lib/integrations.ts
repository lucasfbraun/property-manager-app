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

export type N8nWhatsAppWebhookPayload = WhatsAppReminder & {
  source: "rentals-monolith";
  provider: "waha";
  requestedAt: string;
};

export type WahaTextMessagePayload = {
  session: string;
  chatId: string;
  text: string;
};

export const whatsappAutomationConfig = {
  provider: "WAHA",
  orchestrator: "n8n",
  n8nWebhookEnv: "N8N_WHATSAPP_WEBHOOK_URL",
  n8nWebhookSecretEnv: "N8N_WHATSAPP_WEBHOOK_SECRET",
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

export function buildN8nWhatsAppPayload(
  reminder: WhatsAppReminder,
): N8nWhatsAppWebhookPayload {
  return {
    ...reminder,
    provider: "waha",
    requestedAt: new Date().toISOString(),
    source: "rentals-monolith",
  };
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

export async function sendPaymentReminder(
  message: WhatsAppReminder,
): Promise<void> {
  void message;
  throw new Error(
    "Integracao WhatsApp pendente: configurar n8n + WAHA antes de enviar mensagens reais.",
  );
}
