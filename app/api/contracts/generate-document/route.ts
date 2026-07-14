import { requireApiUser } from "../../../lib/session";
import { generateContractDocument } from "../../../lib/contract-documents";
import { ensureRentalDatabase } from "../../../lib/rental-repository";
import { requiredString, getErrorMessage, errorStatus } from "../../../lib/api-helpers";

export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();
    const payload = (await request.json()) as Record<string, unknown>;
    await generateContractDocument({
      contractId: requiredString(payload.contractId, "contractId"),
      templateId: requiredString(payload.templateId, "templateId"),
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
