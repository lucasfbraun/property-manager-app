import { requireApiUser, UnauthorizedError } from "../../../lib/session";
import {
  getContractTenantId,
  getGeneratedDocumentBinary,
} from "../../../lib/contract-documents";
import { ensureRentalDatabase } from "../../../lib/rental-repository";
import { getErrorMessage, errorStatus } from "../../../lib/api-helpers";

/**
 * Streams the generated (unsigned) contract PDF — includes the vistoria
 * photos when the admin attached any before generating it. Served as a
 * direct binary response (not JSON+base64) so it can be used straight from
 * an <a href> or window.open(), same-origin cookies included automatically.
 */
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

    const document = await getGeneratedDocumentBinary(contractId);
    if (!document) {
      return Response.json({ error: "Documento do contrato ainda nao foi gerado." }, { status: 404 });
    }

    return new Response(document.bytes, {
      headers: {
        "Content-Disposition": `inline; filename="${document.fileName}"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
