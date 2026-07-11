import { requireApiUser, UnauthorizedError } from "../../../lib/session";
import { getContractTenantId } from "../../../lib/contract-documents";
import {
  addInspectionPhoto,
  deleteInspectionPhoto,
  getContractIdForInspectionPhoto,
  getInspectionPhotoBinary,
  listInspectionPhotos,
} from "../../../lib/inspections";
import { ensureRentalDatabase } from "../../../lib/rental-repository";

/**
 * GET ?photoId=... streams the raw image (for <img src="...">).
 * GET ?contractId=... returns the JSON list of photos for that contract.
 * Both admin and the owning tenant can read; only admin can write (POST/DELETE).
 */
export async function GET(request: Request) {
  try {
    const user = await requireApiUser(["admin", "tenant"]);
    await ensureRentalDatabase();

    const url = new URL(request.url);
    const photoId = url.searchParams.get("photoId")?.trim();
    const contractId = url.searchParams.get("contractId")?.trim();

    if (photoId) {
      const photo = await getInspectionPhotoBinary(photoId);
      if (!photo) {
        return Response.json({ error: "Foto nao encontrada." }, { status: 404 });
      }
      if (user.role === "tenant") {
        const ownerId = await getContractTenantId(photo.contractId);
        if (!ownerId || ownerId !== user.tenantId) {
          throw new UnauthorizedError("Foto nao encontrada para este inquilino.");
        }
      }
      return new Response(photo.bytes, {
        headers: {
          "Cache-Control": "private, max-age=3600",
          "Content-Type": photo.contentType,
        },
      });
    }

    if (!contractId) {
      throw new Error("contractId ou photoId e obrigatorio");
    }

    if (user.role === "tenant") {
      const ownerId = await getContractTenantId(contractId);
      if (!ownerId || ownerId !== user.tenantId) {
        throw new UnauthorizedError("Contrato nao encontrado para este inquilino.");
      }
    }

    const photos = await listInspectionPhotos(contractId);
    return Response.json({ photos });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();

    const payload = (await request.json()) as Record<string, unknown>;
    const id = await addInspectionPhoto({
      caption: optionalString(payload.caption),
      contentType: requiredString(payload.contentType, "contentType"),
      contractId: requiredString(payload.contractId, "contractId"),
      fileBase64: requiredString(payload.fileBase64, "fileBase64"),
      fileName: requiredString(payload.fileName, "fileName"),
      room: optionalString(payload.room),
    });

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();

    const payload = (await request.json()) as Record<string, unknown>;
    const id = requiredString(payload.id, "id");
    const contractId =
      optionalString(payload.contractId) || (await getContractIdForInspectionPhoto(id)) || "";

    if (!contractId) {
      throw new Error("Foto de vistoria nao encontrada.");
    }

    await deleteInspectionPhoto({ contractId, id });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

function requiredString(value: unknown, field: string) {
  const parsed = optionalString(value);
  if (!parsed) {
    throw new Error(`${field} is required`);
  }
  return parsed;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errorStatus(error: unknown) {
  return error instanceof UnauthorizedError ? 401 : 400;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
