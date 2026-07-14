import { requireApiUser, UnauthorizedError } from "../../../lib/session";
import {
  getContractTenantId,
  getSignedDocumentBlob,
} from "../../../lib/contract-documents";
import { ensureRentalDatabase } from "../../../lib/rental-repository";
import { getErrorMessage, errorStatus } from "../../../lib/api-helpers";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(["admin", "tenant"]);
    await ensureRentalDatabase();

    const contractId = new URL(request.url).searchParams.get("contractId")?.trim();
    if (!contractId) {
      throw new Error("contractId is required");
    }

    if (user.role === "tenant") {
      const ownerId = await getContractTenantId(contractId);
      if (!ownerId || ownerId !== user.tenantId) {
        throw new UnauthorizedError("Contrato nao encontrado para este inquilino.");
      }
    }

    const document = await getSignedDocumentBlob(contractId);
    if (!document) {
      return Response.json({ error: "Nenhum documento assinado encontrado." }, { status: 404 });
    }

    return Response.json(document);
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
