import { requireApiUser } from "../../lib/session";
import { createContractTemplate,
  deleteContractTemplate,
  listContractTemplates,
  updateContractTemplate } from "../../lib/contract-documents";
import { ensureRentalDatabase } from "../../lib/rental-repository";
import { requiredString, getErrorMessage, errorStatus } from "../../lib/api-helpers";

export async function GET() {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();
    const templates = await listContractTemplates();
    return Response.json({ templates });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();
    const payload = (await request.json()) as Record<string, unknown>;
    const id = await createContractTemplate({
      content: requiredString(payload.content, "content"),
      name: requiredString(payload.name, "name"),
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();
    const payload = (await request.json()) as Record<string, unknown>;
    await updateContractTemplate({
      content: requiredString(payload.content, "content"),
      id: requiredString(payload.id, "id"),
      name: requiredString(payload.name, "name"),
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();
    const payload = (await request.json()) as Record<string, unknown>;
    await deleteContractTemplate(requiredString(payload.id, "id"));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
