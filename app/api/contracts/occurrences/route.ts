import { requireApiUser, UnauthorizedError } from "../../../lib/session";
import { listAdminEmails } from "../../../lib/contract-documents";
import {
  createOccurrence,
  listOccurrencesForAdmin,
  listOccurrencesForTenant,
  occurrenceStatusLabel,
  updateOccurrenceStatus,
  type OccurrenceStatus,
} from "../../../lib/inspections";
import { ensureRentalDatabase } from "../../../lib/rental-repository";
import { sendEmail } from "../../../lib/email";

const VALID_STATUSES: OccurrenceStatus[] = ["open", "in_review", "resolved"];

export async function GET() {
  try {
    const user = await requireApiUser(["admin", "tenant"]);
    await ensureRentalDatabase();

    const occurrences =
      user.role === "admin"
        ? await listOccurrencesForAdmin()
        : await listOccurrencesForTenant(user.tenantId ?? "");

    return Response.json({ occurrences });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser(["tenant"]);
    await ensureRentalDatabase();

    if (!user.tenantId) {
      throw new Error("Sua conta nao esta vinculada a um cadastro de inquilino.");
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const contractId = requiredString(payload.contractId, "contractId");
    const description = requiredString(payload.description, "description");
    const rawPhotos = Array.isArray(payload.photos) ? payload.photos : [];
    const photos = rawPhotos.map((item, index) => {
      const record = item as Record<string, unknown>;
      return {
        contentType: requiredString(record.contentType, `photos[${index}].contentType`),
        fileBase64: requiredString(record.fileBase64, `photos[${index}].fileBase64`),
        fileName: requiredString(record.fileName, `photos[${index}].fileName`),
      };
    });

    const result = await createOccurrence({
      contractId,
      description,
      photos,
      tenantId: user.tenantId,
    });

    try {
      const adminEmails = await listAdminEmails();
      if (adminEmails.length > 0) {
        await sendEmail({
          html: `<p>O inquilino <strong>${escapeHtml(result.tenantName)}</strong> registrou uma ocorrencia no imovel <strong>${escapeHtml(result.propertyName)}</strong>.</p><p>${escapeHtml(description)}</p><p>Acesse o painel "Contratos" para revisar${photos.length > 0 ? ` (${photos.length} foto(s) anexada(s))` : ""}.</p>`,
          subject: `Nova ocorrencia reportada: ${result.propertyName}`,
          to: adminEmails,
        });
      }
    } catch (emailError) {
      console.error("[occurrences] falha ao notificar admins por e-mail:", emailError);
    }

    return Response.json({ id: result.id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();

    const payload = (await request.json()) as Record<string, unknown>;
    const id = requiredString(payload.id, "id");
    const status = requiredString(payload.status, "status") as OccurrenceStatus;
    if (!VALID_STATUSES.includes(status)) {
      throw new Error("status invalido");
    }
    const resolutionNote = typeof payload.resolutionNote === "string" ? payload.resolutionNote.trim() : undefined;

    const result = await updateOccurrenceStatus({ id, resolutionNote, status });

    try {
      const noteHtml = resolutionNote ? `<p>Observacao: ${escapeHtml(resolutionNote)}</p>` : "";
      await sendEmail({
        html: `<p>Sua ocorrencia sobre o imovel <strong>${escapeHtml(result.propertyName)}</strong> foi atualizada para <strong>${occurrenceStatusLabel(status)}</strong>.</p>${noteHtml}`,
        subject: `Ocorrencia atualizada: ${result.propertyName}`,
        to: [result.tenantEmail],
      });
    } catch (emailError) {
      console.error("[occurrences] falha ao notificar inquilino por e-mail:", emailError);
    }

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function errorStatus(error: unknown) {
  return error instanceof UnauthorizedError ? 401 : 400;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
