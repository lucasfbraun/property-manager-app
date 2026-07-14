import { requireApiUser } from "../../../lib/session";
import { listAdminEmails,
  uploadSignedContract } from "../../../lib/contract-documents";
import { ensureRentalDatabase } from "../../../lib/rental-repository";
import { sendEmail } from "../../../lib/email";
import { requiredString, getErrorMessage, errorStatus, escapeHtml } from "../../../lib/api-helpers";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(["tenant"]);
    await ensureRentalDatabase();

    if (!user.tenantId) {
      throw new Error("Sua conta nao esta vinculada a um cadastro de inquilino.");
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const contractId = requiredString(payload.contractId, "contractId");
    const fileBase64 = requiredString(payload.fileBase64, "fileBase64");
    const fileName = requiredString(payload.fileName, "fileName");

    const result = await uploadSignedContract({
      contractId,
      fileBase64,
      fileName,
      tenantId: user.tenantId,
    });

    // Best-effort notification; failure to send e-mail should not fail the
    // upload itself (Resend may not be configured yet).
    try {
      const adminEmails = await listAdminEmails();
      const recipients = [...adminEmails, result.receiverEmail];
      await sendEmail({
        html: `<p>O inquilino <strong>${escapeHtml(result.tenantName)}</strong> enviou o contrato assinado do imovel <strong>${escapeHtml(result.propertyName)}</strong> para aprovacao.</p><p>Acesse o painel "Contratos" para revisar.</p>`,
        subject: `Contrato assinado enviado: ${result.propertyName}`,
        to: recipients,
      });
    } catch (emailError) {
      console.error("[upload-signed] falha ao notificar por e-mail:", emailError);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
