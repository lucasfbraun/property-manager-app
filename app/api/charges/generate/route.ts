import { requireApiUser } from "../../../lib/session";
import { generateChargeForContract } from "../../../lib/charge-scheduler";
import { requiredString, getErrorMessage, errorStatus } from "../../../lib/api-helpers";

export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
    const payload = (await request.json()) as Record<string, unknown>;
    const contractId = requiredString(payload.contractId, "contractId");
    const result = await generateChargeForContract(contractId);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
