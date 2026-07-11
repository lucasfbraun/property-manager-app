import { requireApiUser, UnauthorizedError } from "../../../lib/session";
import { getWaterBillInvoiceBinary } from "../../../lib/water-bills";
import { ensureRentalDatabase } from "../../../lib/rental-repository";

/** Streams the uploaded water bill invoice (admin only, no tenant access). */
export async function GET(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();

    const waterBillId = new URL(request.url).searchParams.get("waterBillId")?.trim();
    if (!waterBillId) {
      throw new Error("waterBillId is required");
    }

    const invoice = await getWaterBillInvoiceBinary(waterBillId);
    if (!invoice) {
      return Response.json({ error: "Fatura nao encontrada." }, { status: 404 });
    }

    return new Response(invoice.bytes, {
      headers: {
        "Content-Disposition": `inline; filename="${invoice.fileName}"`,
        "Content-Type": invoice.contentType,
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
