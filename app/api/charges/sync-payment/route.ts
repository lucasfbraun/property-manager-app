import { requireApiUser } from "../../../lib/session";
import { getLatestChargeIdForContract, syncChargePayment } from "../../../lib/mercadopago";
import { sendPaymentConfirmedReminder } from "../../../lib/reminders";
import { requiredString, getErrorMessage, errorStatus } from "../../../lib/api-helpers";

/**
 * Manual fallback for when the Mercado Pago webhook doesn't arrive (wrong/
 * missing production webhook config, delivery failure, etc.): looks up the
 * latest charge for a contract and reconciles it directly against the MP
 * Payments API.
 */
export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
    const payload = (await request.json()) as Record<string, unknown>;
    const contractId = requiredString(payload.contractId, "contractId");

    const chargeId = await getLatestChargeIdForContract(contractId);
    if (!chargeId) {
      throw new Error("Nenhuma cobranca encontrada para esse contrato.");
    }

    const result = await syncChargePayment(chargeId);

    if (result.updated) {
      try {
        await sendPaymentConfirmedReminder(chargeId);
      } catch (whatsappError) {
        console.error("[sync-payment] falha ao notificar por whatsapp:", whatsappError);
      }
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
