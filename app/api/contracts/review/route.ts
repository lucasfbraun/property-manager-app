import { requireApiUser } from "../../../lib/session";
import { reviewSignedContract } from "../../../lib/contract-documents";
import { ensureRentalDatabase } from "../../../lib/rental-repository";
import { sendEmail } from "../../../lib/email";
import { requiredString, getErrorMessage, errorStatus, escapeHtml } from "../../../lib/api-helpers";

export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();

    const payload = (await request.json()) as Record<string, unknown>;
    const contractId = requiredString(payload.contractId, "contractId");
    const decisionRaw = requiredString(payload.decision, "decision");
    if (decisionRaw !== "approved" && decisionRaw !== "rejected") {
      throw new Error("decision deve ser 'approved' ou 'rejected'");
    }
    const note = typeof payload.note === "string" ? payload.note.trim() : undefined;

    const result = await reviewSignedContract({
      contractId,
      decision: decisionRaw,
      note: note || undefined,
    });

    try {
      const approved = result.decision === "approved";
      const statusLabel = approved ? "aprovado" : "rejeitado";
      const noteHtml = result.note
        ? `<p>Observacao do administrador: ${escapeHtml(result.note)}</p>`
        : "";
      const html = `<p>O contrato do imovel <strong>${escapeHtml(result.propertyName)}</strong> foi <strong>${statusLabel}</strong>.</p>${noteHtml}${
        approved
          ? ""
          : "<p>O inquilino pode enviar um novo arquivo assinado pelo portal.</p>"
      }`;

      await sendEmail({
        html,
        subject: `Contrato ${statusLabel}: ${result.propertyName}`,
        to: [result.tenantEmail, result.receiverEmail],
      });
    } catch (emailError) {
      console.error("[review] falha ao notificar por e-mail:", emailError);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
