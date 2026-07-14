import { requireApiUser } from "../../../lib/session";
import { getRateioInvoiceBinary } from "../../../lib/rateios";
import { ensureRentalDatabase } from "../../../lib/rental-repository";
import { getErrorMessage, errorStatus } from "../../../lib/api-helpers";

/** Streams the uploaded rateio invoice/receipt (admin only, no tenant access). */
export async function GET(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();

    const rateioId = new URL(request.url).searchParams.get("rateioId")?.trim();
    if (!rateioId) {
      throw new Error("rateioId is required");
    }

    const invoice = await getRateioInvoiceBinary(rateioId);
    if (!invoice) {
      return Response.json({ error: "Comprovante nao encontrado." }, { status: 404 });
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
