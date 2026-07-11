import { requireApiUser, UnauthorizedError } from "../../../lib/session";
import { getChargeStatus, getChargeTenantId } from "../../../lib/mercadopago";
import { buildReceiptPdf } from "../../../lib/receipt-pdf";
import { ensureRentalDatabase } from "../../../lib/rental-repository";

/**
 * Streams the payment receipt PDF for a paid charge. Content is fixed/
 * placeholder for now (see app/lib/receipt-pdf.ts); only gated on the charge
 * actually being paid, same auth/ownership pattern as the contract document
 * route (admin, or the owning tenant).
 */
export async function GET(request: Request) {
  try {
    const user = await requireApiUser(["admin", "tenant"]);
    await ensureRentalDatabase();

    const chargeId = new URL(request.url).searchParams.get("chargeId")?.trim();
    if (!chargeId) {
      throw new Error("chargeId is required");
    }

    if (user.role === "tenant") {
      const ownerId = await getChargeTenantId(chargeId);
      if (!ownerId || ownerId !== user.tenantId) {
        throw new UnauthorizedError("Cobranca nao encontrada para este inquilino.");
      }
    }

    const status = await getChargeStatus(chargeId);
    if (status !== "paid") {
      return Response.json(
        { error: "Recibo disponivel somente apos a cobranca ser marcada como paga." },
        { status: 409 },
      );
    }

    const bytes = await buildReceiptPdf();

    return new Response(bytes, {
      headers: {
        "Content-Disposition": `inline; filename="recibo-${chargeId}.pdf"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

function errorStatus(error: unknown) {
  return error instanceof UnauthorizedError ? 401 : 400;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
