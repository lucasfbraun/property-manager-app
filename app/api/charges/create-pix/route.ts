import { requireApiUser, UnauthorizedError } from "../../../lib/session";
import { createPixCharge, getChargeTenantId } from "../../../lib/mercadopago";
import { ensureRentalDatabase } from "../../../lib/rental-repository";
import { requiredString, getErrorMessage, errorStatus } from "../../../lib/api-helpers";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(["admin", "tenant"]);
    await ensureRentalDatabase();
    const payload = (await request.json()) as Record<string, unknown>;
    const chargeId = requiredString(payload.chargeId, "chargeId");

    if (user.role === "tenant") {
      const ownerTenantId = await getChargeTenantId(chargeId);
      if (!ownerTenantId || ownerTenantId !== user.tenantId) {
        throw new UnauthorizedError("Cobranca nao encontrada para este inquilino.");
      }
    }

    const result = await createPixCharge(chargeId);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
