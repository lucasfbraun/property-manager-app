import { requireApiUser } from "../../../lib/session";
import { searchHelp } from "../../../lib/help-content";
import { getErrorMessage, errorStatus } from "../../../lib/api-helpers";

/**
 * Admin-only FAQ search for the in-panel help chat. Deliberately does not
 * touch the rental database at all: it only ranks the static entries in
 * app/lib/help-content.ts against the query, so no tenant/contract/payment
 * data can ever leak through this endpoint.
 */
export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
    const payload = (await request.json()) as { query?: unknown };
    const query = typeof payload.query === "string" ? payload.query.trim() : "";
    if (!query) {
      return Response.json({ results: [] });
    }

    const results = searchHelp(query).map((entry) => ({
      answer: entry.answer,
      id: entry.id,
      title: entry.title,
    }));

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
