import { env } from "cloudflare:workers";
import { getD1 } from "../../db";
import { computeAmountDue } from "./finance";
import { createId } from "./ids";

const MP_OAUTH_AUTHORIZE_URL = "https://auth.mercadopago.com/authorization";
const MP_OAUTH_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const MP_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";
const CALLBACK_PATH = "/api/mercadopago/callback";

type MpTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user_id: number;
  refresh_token?: string;
  public_key?: string;
  live_mode?: boolean;
};

function getConfig() {
  const config = env as unknown as Record<string, unknown>;
  const clientId = config.MP_CLIENT_ID as string | undefined;
  const clientSecret = config.MP_CLIENT_SECRET as string | undefined;
  const webhookSecret = config.MP_WEBHOOK_SECRET as string | undefined;
  // Optional: only set to "true" in Cloudflare while connecting MP sandbox
  // test-user accounts. Leave unset/false for real receivers so the OAuth
  // exchange returns a real (APP_USR) access token.
  const sandboxConnect = config.MP_SANDBOX_CONNECT === "true";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Integracao com Mercado Pago nao configurada. Defina os secrets MP_CLIENT_ID e MP_CLIENT_SECRET na Cloudflare.",
    );
  }

  return { clientId, clientSecret, sandboxConnect, webhookSecret };
}

/** Builds the redirect_uri that must match exactly what is registered in the Mercado Pago app. */
export function buildRedirectUri(origin: string): string {
  return `${origin}${CALLBACK_PATH}`;
}

const STATE_TTL_MS = 20 * 60 * 1000;

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Signed, stateless CSRF token for the OAuth `state` param (no DB round-trip needed). */
export async function signConnectState(receiverId: string): Promise<string> {
  const { clientSecret } = getConfig();
  const timestamp = Date.now();
  const payload = `${receiverId}.${timestamp}`;
  const signature = await hmacHex(clientSecret, payload);
  return btoa(`${payload}.${signature}`);
}

export async function verifyConnectState(state: string): Promise<string> {
  const { clientSecret } = getConfig();
  let decoded: string;
  try {
    decoded = atob(state);
  } catch {
    throw new Error("State invalido.");
  }

  const parts = decoded.split(".");
  if (parts.length !== 3) {
    throw new Error("State invalido.");
  }
  const [receiverId, timestampRaw, signature] = parts;
  const timestamp = Number(timestampRaw);
  if (!receiverId || !Number.isFinite(timestamp)) {
    throw new Error("State invalido.");
  }

  const expected = await hmacHex(clientSecret, `${receiverId}.${timestampRaw}`);
  if (expected !== signature) {
    throw new Error("State invalido (assinatura nao confere).");
  }

  if (Date.now() - timestamp > STATE_TTL_MS) {
    throw new Error("Link de conexao expirado. Gere um novo.");
  }

  return receiverId;
}

export async function getAuthorizationUrl(receiverId: string, origin: string): Promise<string> {
  const { clientId } = getConfig();
  const state = await signConnectState(receiverId);
  const url = new URL(MP_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", buildRedirectUri(origin));
  url.searchParams.set("state", state);
  return url.toString();
}

async function requestToken(body: Record<string, unknown>): Promise<MpTokenResponse> {
  const response = await fetch(MP_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Falha ao obter token do Mercado Pago (${response.status}): ${text}`);
  }

  return (await response.json()) as MpTokenResponse;
}

export async function exchangeCodeForTokens(
  code: string,
  origin: string,
): Promise<MpTokenResponse> {
  const { clientId, clientSecret, sandboxConnect } = getConfig();
  return requestToken({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: buildRedirectUri(origin),
    // Sandbox-only flag: per MP docs, this forces the exchange to return a
    // TEST access token instead of a live one. Off by default so real
    // receivers get a real (APP_USR) token; flip MP_SANDBOX_CONNECT=true in
    // Cloudflare only while testing with sandbox test-user accounts.
    ...(sandboxConnect ? { test_token: true } : {}),
  });
}

/** TEST- prefixed access tokens are sandbox-only, regardless of what live_mode reports. */
function isLiveToken(token: MpTokenResponse): boolean {
  if (token.access_token.startsWith("TEST-")) {
    return false;
  }
  return token.live_mode ?? true;
}

export async function saveReceiverConnection(
  receiverId: string,
  token: MpTokenResponse,
) {
  const d1 = getD1();
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  await d1
    .prepare(
      `UPDATE receivers SET mp_user_id = ?, mp_access_token = ?, mp_refresh_token = ?,
        mp_token_expires_at = ?, mp_connected_at = ?, mp_live_mode = ?
       WHERE id = ?`,
    )
    .bind(
      String(token.user_id),
      token.access_token,
      token.refresh_token ?? null,
      expiresAt,
      new Date().toISOString(),
      // live_mode comes back from MP's /oauth/token response; when absent we
      // infer it from the access token prefix (TEST- tokens are sandbox-only).
      isLiveToken(token) ? 1 : 0,
      receiverId,
    )
    .run();
}

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Returns a valid access token for the receiver, refreshing it first if it's about to expire. */
export async function ensureFreshAccessToken(receiverId: string): Promise<string> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      "SELECT mp_access_token, mp_refresh_token, mp_token_expires_at FROM receivers WHERE id = ?",
    )
    .bind(receiverId)
    .first<{
      mp_access_token: string | null;
      mp_refresh_token: string | null;
      mp_token_expires_at: string | null;
    }>();

  if (!row?.mp_access_token) {
    throw new Error(
      "Este recebedor ainda nao conectou a conta Mercado Pago. Conecte antes de gerar um Pix.",
    );
  }

  const expiresAt = row.mp_token_expires_at ? new Date(row.mp_token_expires_at).getTime() : 0;
  const isExpiringSoon = expiresAt - Date.now() < TOKEN_REFRESH_MARGIN_MS;

  if (!isExpiringSoon) {
    return row.mp_access_token;
  }

  if (!row.mp_refresh_token) {
    // No refresh token available; fall back to the current access token and
    // let the Payments API call fail loudly if it's actually expired.
    return row.mp_access_token;
  }

  const { clientId, clientSecret } = getConfig();
  const refreshed = await requestToken({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: row.mp_refresh_token,
  });

  await saveReceiverConnection(receiverId, refreshed);
  return refreshed.access_token;
}

/** App-level (platform) access token, used by the webhook to look up a payment regardless of which connected receiver it belongs to. */
export async function getPlatformAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getConfig();
  const token = await requestToken({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });
  return token.access_token;
}

export function getWebhookSecret(): string | undefined {
  return getConfig().webhookSecret;
}

/**
 * Validates the Mercado Pago webhook `x-signature` header.
 * Format: "ts=<timestamp>,v1=<hex hmac>". Manifest per MP docs:
 * "id:{data.id};request-id:{x-request-id header};ts:{ts};"
 */
export async function validateWebhookSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string,
): Promise<boolean> {
  const secret = getWebhookSecret();
  if (!secret) {
    // Signature validation not configured yet; allow through but the caller
    // should treat this as "unverified" (log it) rather than silently trust it forever.
    return true;
  }

  if (!xSignature) {
    return false;
  }

  const parts = Object.fromEntries(
    xSignature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId ?? ""};ts:${ts};`;
  const expected = await hmacHex(secret, manifest);
  return expected === v1;
}

type PixChargeRow = {
  id: string;
  original_amount: number;
  due_date: string;
  status: string;
  contract_id: string;
  receiver_id: string;
  grace_days: number;
  fine_rate: number;
  monthly_interest_rate: number;
  tenant_email: string;
  tenant_name: string;
  tenant_document: string;
};

/**
 * Computes the amount currently due for a charge using the real clock (not
 * the fixed demo `businessDate` used by the dashboard projections), since
 * this drives an actual Pix payment amount.
 */
export function computeCurrentAmountDue(row: PixChargeRow): number {
  return computeAmountDue({
    dueDate: row.due_date,
    fineRate: row.fine_rate,
    graceDays: row.grace_days,
    monthlyInterestRate: row.monthly_interest_rate,
    originalAmount: row.original_amount,
    status: row.status,
  });
}

/**
 * MP's Payments API requires payer.identification (CPF/CNPJ) to validate the
 * payer; without it, the API can reject the payment with a generic
 * "Invalid users involved" error instead of a clear validation message.
 */
function buildPayerIdentification(document: string): { type: string; number: string } {
  const digits = document.replace(/\D/g, "");
  return {
    number: digits,
    type: digits.length > 11 ? "CNPJ" : "CPF",
  };
}

/**
 * MP's date_of_expiration expects an explicit numeric UTC offset
 * (e.g. "-03:00"); some accounts reject the "Z" suffix that
 * Date.prototype.toISOString() produces with an opaque 500 internal_error.
 * Shifts the instant by -3h before formatting so the local (Sao Paulo)
 * wall-clock value stays correct, then labels it with the -03:00 offset.
 */
function toSaoPauloOffsetTimestamp(isoUtc: string): string {
  const shifted = new Date(new Date(isoUtc).getTime() - 3 * 60 * 60 * 1000);
  return `${shifted.toISOString().replace("Z", "")}-03:00`;
}

export async function createPixCharge(chargeId: string): Promise<{
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  paymentId: string;
}> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      `SELECT c.id as id, c.original_amount as original_amount, c.due_date as due_date,
              c.status as status, c.contract_id as contract_id, c.receiver_id as receiver_id,
              ct.grace_days as grace_days, ct.fine_rate as fine_rate,
              ct.monthly_interest_rate as monthly_interest_rate,
              t.email as tenant_email, t.name as tenant_name, t.document as tenant_document
       FROM charges c
       JOIN contracts ct ON ct.id = c.contract_id
       JOIN tenants t ON t.id = ct.tenant_id
       WHERE c.id = ?`,
    )
    .bind(chargeId)
    .first<PixChargeRow>();

  if (!row) {
    throw new Error("Cobranca nao encontrada.");
  }

  if (row.status === "paid" || row.status === "cancelled") {
    throw new Error("Esta cobranca nao esta em aberto.");
  }

  const accessToken = await ensureFreshAccessToken(row.receiver_id);
  const amount = Math.round(computeCurrentAmountDue(row) * 100) / 100;
  const expirationDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const [firstName, ...rest] = row.tenant_name.split(" ");

  const response = await fetch(MP_PAYMENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `${chargeId}-${Date.now()}`,
    },
    body: JSON.stringify({
      transaction_amount: amount,
      payment_method_id: "pix",
      description: `Aluguel - cobranca ${chargeId}`,
      external_reference: chargeId,
      date_of_expiration: toSaoPauloOffsetTimestamp(expirationDate),
      payer: {
        email: row.tenant_email,
        first_name: firstName || row.tenant_name,
        last_name: rest.join(" ") || "-",
        identification: buildPayerIdentification(row.tenant_document),
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Falha ao criar cobranca Pix no Mercado Pago (${response.status}): ${text}`);
  }

  const payment = (await response.json()) as {
    id: number;
    point_of_interaction?: {
      transaction_data?: { qr_code?: string; qr_code_base64?: string };
    };
  };

  const qrCode = payment.point_of_interaction?.transaction_data?.qr_code ?? "";
  const qrCodeBase64 = payment.point_of_interaction?.transaction_data?.qr_code_base64 ?? "";

  await d1
    .prepare(
      `UPDATE charges SET mercado_pago_payment_id = ?, pix_qr_code = ?, pix_qr_code_base64 = ?,
        pix_expires_at = ?, status = 'waiting_payment'
       WHERE id = ?`,
    )
    .bind(String(payment.id), qrCode, qrCodeBase64, expirationDate, chargeId)
    .run();

  return {
    expiresAt: expirationDate,
    paymentId: String(payment.id),
    qrCode,
    qrCodeBase64,
  };
}

export async function fetchPaymentDetails(paymentId: string): Promise<{
  status: string;
  externalReference: string | null;
  transactionAmount: number;
  netReceivedAmount: number | null;
  feeAmount: number | null;
  dateApproved: string | null;
}> {
  const accessToken = await getPlatformAccessToken();
  const response = await fetch(`${MP_PAYMENTS_URL}/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Falha ao consultar pagamento no Mercado Pago (${response.status}): ${text}`);
  }

  const payment = (await response.json()) as {
    status: string;
    external_reference: string | null;
    transaction_amount: number;
    date_approved: string | null;
    transaction_details?: { net_received_amount?: number };
    fee_details?: Array<{ amount: number }>;
  };

  const feeAmount = payment.fee_details?.reduce((sum, fee) => sum + fee.amount, 0) ?? null;

  return {
    dateApproved: payment.date_approved,
    externalReference: payment.external_reference,
    feeAmount,
    netReceivedAmount: payment.transaction_details?.net_received_amount ?? null,
    status: payment.status,
    transactionAmount: payment.transaction_amount,
  };
}

/**
 * Manual fallback for when the Mercado Pago webhook doesn't arrive (e.g. the
 * production webhook wasn't configured yet when the payment was made): looks
 * up the payment directly and reconciles the charge, reusing the same
 * idempotent recording logic the webhook uses.
 */
export async function syncChargePayment(chargeId: string): Promise<{
  status: string;
  updated: boolean;
}> {
  const d1 = getD1();
  const row = await d1
    .prepare("SELECT mercado_pago_payment_id, status FROM charges WHERE id = ?")
    .bind(chargeId)
    .first<{ mercado_pago_payment_id: string | null; status: string }>();

  if (!row?.mercado_pago_payment_id) {
    throw new Error("Essa cobranca ainda nao tem um pagamento Pix gerado.");
  }

  if (row.status === "paid") {
    return { status: "already_paid", updated: false };
  }

  const payment = await fetchPaymentDetails(row.mercado_pago_payment_id);
  if (payment.status !== "approved" || !payment.externalReference) {
    return { status: payment.status, updated: false };
  }

  const isNew = await recordApprovedPayment({
    amountPaid: payment.transactionAmount,
    chargeId: payment.externalReference,
    externalId: row.mercado_pago_payment_id,
    fees: payment.feeAmount,
    netAmount: payment.netReceivedAmount,
    paidAt: payment.dateApproved ?? new Date().toISOString(),
  });

  return { status: "approved", updated: isNew };
}

/** Most recent charge for a contract, used by the admin "sync payment" action. */
export async function getLatestChargeIdForContract(contractId: string): Promise<string | null> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      "SELECT id FROM charges WHERE contract_id = ? ORDER BY due_date DESC LIMIT 1",
    )
    .bind(contractId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

/** Raw DB status ('open' | 'waiting_payment' | 'paid' | 'cancelled' | ...), used to gate the payment receipt. */
export async function getChargeStatus(chargeId: string): Promise<string | null> {
  const d1 = getD1();
  const row = await d1
    .prepare("SELECT status FROM charges WHERE id = ?")
    .bind(chargeId)
    .first<{ status: string }>();
  return row?.status ?? null;
}

export async function getChargeTenantId(chargeId: string): Promise<string | null> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      "SELECT ct.tenant_id as tenant_id FROM charges c JOIN contracts ct ON ct.id = c.contract_id WHERE c.id = ?",
    )
    .bind(chargeId)
    .first<{ tenant_id: string }>();
  return row?.tenant_id ?? null;
}

/**
 * Idempotently records an approved payment (webhooks can be delivered more
 * than once for the same event) and marks the charge as paid. Returns false
 * if this externalId was already recorded, so the caller can skip
 * re-sending the confirmation e-mail.
 */
export async function recordApprovedPayment(input: {
  chargeId: string;
  externalId: string;
  amountPaid: number;
  netAmount: number | null;
  fees: number | null;
  paidAt: string;
}): Promise<boolean> {
  const d1 = getD1();
  const existing = await d1
    .prepare("SELECT id FROM payments WHERE external_id = ?")
    .bind(input.externalId)
    .first<{ id: string }>();

  if (existing) {
    return false;
  }

  const paymentId = createId("pay");

  await d1.batch([
    d1.prepare("UPDATE charges SET status = 'paid' WHERE id = ?").bind(input.chargeId),
    d1
      .prepare(
        `INSERT INTO payments (id, charge_id, amount_paid, net_amount, fees, method, status, paid_at, external_id)
         VALUES (?, ?, ?, ?, ?, 'pix', 'approved', ?, ?)`,
      )
      .bind(
        paymentId,
        input.chargeId,
        input.amountPaid,
        input.netAmount,
        input.fees,
        input.paidAt,
        input.externalId,
      ),
  ]);

  return true;
}

export async function getChargeStakeholders(chargeId: string): Promise<{
  tenantName: string;
  tenantEmail: string;
  receiverName: string;
  receiverEmail: string;
  propertyName: string;
} | null> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      `SELECT t.name as tenant_name, t.email as tenant_email,
              r.name as receiver_name, r.email as receiver_email,
              p.name as property_name
       FROM charges c
       JOIN contracts ct ON ct.id = c.contract_id
       JOIN tenants t ON t.id = ct.tenant_id
       JOIN receivers r ON r.id = ct.receiver_id
       JOIN properties p ON p.id = ct.property_id
       WHERE c.id = ?`,
    )
    .bind(chargeId)
    .first<{
      tenant_name: string;
      tenant_email: string;
      receiver_name: string;
      receiver_email: string;
      property_name: string;
    }>();

  if (!row) {
    return null;
  }

  return {
    propertyName: row.property_name,
    receiverEmail: row.receiver_email,
    receiverName: row.receiver_name,
    tenantEmail: row.tenant_email,
    tenantName: row.tenant_name,
  };
}

type ChargeReminderRow = PixChargeRow & {
  tenant_whatsapp: string;
  property_name: string;
  receiver_name: string;
  contract_ends_at: string;
};

/** Everything a WhatsApp reminder needs about a charge, in one lookup (app/lib/reminders.ts). */
export async function getChargeReminderContext(chargeId: string): Promise<{
  chargeId: string;
  status: string;
  dueDateIso: string;
  amountDue: number;
  tenantName: string;
  tenantPhone: string;
  propertyName: string;
  receiverName: string;
  contractEndsAt: string;
} | null> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      `SELECT c.id as id, c.original_amount as original_amount, c.due_date as due_date,
              c.status as status, c.contract_id as contract_id, c.receiver_id as receiver_id,
              ct.grace_days as grace_days, ct.fine_rate as fine_rate,
              ct.monthly_interest_rate as monthly_interest_rate, ct.ends_at as contract_ends_at,
              t.email as tenant_email, t.name as tenant_name, t.document as tenant_document,
              t.whatsapp as tenant_whatsapp,
              p.name as property_name, r.name as receiver_name
       FROM charges c
       JOIN contracts ct ON ct.id = c.contract_id
       JOIN tenants t ON t.id = ct.tenant_id
       JOIN properties p ON p.id = ct.property_id
       JOIN receivers r ON r.id = ct.receiver_id
       WHERE c.id = ?`,
    )
    .bind(chargeId)
    .first<ChargeReminderRow>();

  if (!row) {
    return null;
  }

  return {
    amountDue: computeCurrentAmountDue(row),
    chargeId: row.id,
    contractEndsAt: row.contract_ends_at,
    dueDateIso: row.due_date,
    propertyName: row.property_name,
    receiverName: row.receiver_name,
    status: row.status,
    tenantName: row.tenant_name,
    tenantPhone: row.tenant_whatsapp,
  };
}

