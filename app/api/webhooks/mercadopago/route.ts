import {
  fetchPaymentDetails,
  getChargeStakeholders,
  recordApprovedPayment,
  validateWebhookSignature,
} from "../../../lib/mercadopago";
import { ensureRentalDatabase } from "../../../lib/rental-repository";
import { sendEmail } from "../../../lib/email";

/**
 * Public webhook (Mercado Pago servers call this, no session/cookie
 * involved). Authenticity is checked via the x-signature header instead.
 * Returns 200 quickly for events we intentionally ignore, and a non-2xx
 * status for real failures so Mercado Pago retries delivery.
 */
export async function POST(request: Request) {
  try {
    await ensureRentalDatabase();
    const url = new URL(request.url);
    const rawBody = await request.text();

    let body: Record<string, unknown> = {};
    try {
      body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch {
      body = {};
    }

    const data = body.data as Record<string, unknown> | undefined;
    const type = (body.type as string | undefined) ?? (body.topic as string | undefined) ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
    const dataId =
      (data?.id as string | number | undefined) ??
      url.searchParams.get("data.id") ??
      url.searchParams.get("id");

    if (type !== "payment" || !dataId) {
      return Response.json({ ignored: true, ok: true });
    }

    const isValid = await validateWebhookSignature(
      request.headers.get("x-signature"),
      request.headers.get("x-request-id"),
      String(dataId),
    );
    if (!isValid) {
      return Response.json({ error: "Assinatura invalida" }, { status: 401 });
    }

    const payment = await fetchPaymentDetails(String(dataId));
    if (payment.status !== "approved" || !payment.externalReference) {
      return Response.json({ ok: true, status: payment.status });
    }

    const chargeId = payment.externalReference;
    const isNew = await recordApprovedPayment({
      amountPaid: payment.transactionAmount,
      chargeId,
      externalId: String(dataId),
      fees: payment.feeAmount,
      netAmount: payment.netReceivedAmount,
      paidAt: payment.dateApproved ?? new Date().toISOString(),
    });

    if (isNew) {
      try {
        const stakeholders = await getChargeStakeholders(chargeId);
        if (stakeholders) {
          await sendEmail({
            html: `<p>O pagamento Pix referente ao imovel <strong>${escapeHtml(stakeholders.propertyName)}</strong> foi confirmado.</p>`,
            subject: `Pagamento confirmado: ${stakeholders.propertyName}`,
            to: [stakeholders.tenantEmail, stakeholders.receiverEmail],
          });
        }
      } catch (emailError) {
        console.error("[webhook mercadopago] falha ao notificar por e-mail:", emailError);
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[webhook mercadopago] erro ao processar notificacao:", error);
    return Response.json({ error: "Erro ao processar notificacao" }, { status: 500 });
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
