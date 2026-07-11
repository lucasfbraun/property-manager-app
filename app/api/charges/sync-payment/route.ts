import { requireApiUser, UnauthorizedError } from "../../../lib/session";
import { getLatestChargeIdForContract, syncChargePayment } from "../../../lib/mercadopago";

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
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

function requiredString(value: unknown, field: string) {
  const parsed = typeof value === "string" ? value.trim() : "";
  if (!parsed) {
    throw new Error(`${field} is required`);
  }
  return parsed;
}

function errorStatus(error: unknown) {
  return error instanceof UnauthorizedError ? 401 : 400;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
