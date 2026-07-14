import { requireApiUser } from "../../../lib/session";
import { getLatestChargeIdForContract } from "../../../lib/mercadopago";
import { sendChargeReminder } from "../../../lib/reminders";
import { ensureRentalDatabase } from "../../../lib/rental-repository";
import { requiredString, getErrorMessage, errorStatus } from "../../../lib/api-helpers";

/**
 * Manual "Enviar lembrete WhatsApp" button (admin only): sends whichever
 * reminder currently makes sense (antes do vencimento, no dia, atraso ou
 * pagamento confirmado) for the contract's latest charge, via WAHA.
 */
export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();
    const payload = (await request.json()) as Record<string, unknown>;
    const contractId = requiredString(payload.contractId, "contractId");

    const chargeId = await getLatestChargeIdForContract(contractId);
    if (!chargeId) {
      throw new Error("Nenhuma cobranca encontrada para esse contrato. Gere a cobranca antes.");
    }

    const result = await sendChargeReminder(chargeId);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
