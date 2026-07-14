import { requireApiUser } from "../../../lib/session";
import { setContractOwnerSigned,
  setContractWitnessSigned } from "../../../lib/rental-repository";
import { requiredString, getErrorMessage, errorStatus } from "../../../lib/api-helpers";

/**
 * Lets the admin acknowledge that the property owner (proprietario) or a
 * witness (testemunha) physically signed the printed contract — neither has
 * a portal/login, so this is a manual checklist rather than a real
 * electronic signature. Once every witness and the owner (when the property
 * has one) are marked signed, the tenant's turn to sign unlocks in the
 * tenant portal (see isContractReadyForTenantSignature in app/lib/rentals.ts).
 */
export async function PATCH(request: Request) {
  try {
    await requireApiUser(["admin"]);
    const payload = (await request.json()) as Record<string, unknown>;
    const target = requiredString(payload.target, "target");
    const signed = Boolean(payload.signed);

    if (target === "owner") {
      await setContractOwnerSigned(requiredString(payload.contractId, "contractId"), signed);
    } else if (target === "witness") {
      await setContractWitnessSigned(
        requiredString(payload.contractWitnessId, "contractWitnessId"),
        signed,
      );
    } else {
      throw new Error("target invalido");
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
