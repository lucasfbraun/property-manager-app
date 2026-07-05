import { requireApiUser, UnauthorizedError } from "../../../lib/session";
import { generateContractDocument } from "../../../lib/contract-documents";
import { ensureRentalDatabase } from "../../../lib/rental-repository";

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
