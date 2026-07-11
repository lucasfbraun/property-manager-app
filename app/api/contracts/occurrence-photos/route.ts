import { requireApiUser, UnauthorizedError } from "../../../lib/session";
import { getOccurrencePhotoBinary, getTenantIdForOccurrencePhoto } from "../../../lib/inspections";
import { ensureRentalDatabase } from "../../../lib/rental-repository";

/** Streams a single occurrence photo (for <img src="...">). */
export async function GET(request: Request) {
  try {
    const user = await requireApiUser(["admin", "tenant"]);
    await ensureRentalDatabase();

    const photoId = new URL(request.url).searchParams.get("photoId")?.trim();
    if (!photoId) {
      throw new Error("photoId is required");
    }

    if (user.role === "tenant") {
      const ownerId = await getTenantIdForOccurrencePhoto(photoId);
      if (!ownerId || ownerId !== user.tenantId) {
        throw new UnauthorizedError("Foto nao encontrada para este inquilino.");
      }
    }

    const photo = await getOccurrencePhotoBinary(photoId);
    if (!photo) {
      return Response.json({ error: "Foto nao encontrada." }, { status: 404 });
    }

    return new Response(photo.bytes, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Type": photo.contentType,
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
