import { requireApiUser } from "../../../lib/session";
import { getAuthorizationUrl } from "../../../lib/mercadopago";
import { ensureRentalDatabase } from "../../../lib/rental-repository";
import { getErrorMessage, errorStatus } from "../../../lib/api-helpers";

export async function GET(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();
    const url = new URL(request.url);
    const receiverId = url.searchParams.get("receiverId")?.trim();
    if (!receiverId) {
      throw new Error("receiverId is required");
    }

    const authorizationUrl = await getAuthorizationUrl(receiverId, url.origin);
    return Response.redirect(authorizationUrl, 302);
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
