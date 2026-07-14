import { requireApiUser } from "../../lib/session";
import { createOwner, deleteOwner, updateOwner } from "../../lib/rental-repository";
import { requiredString, optionalString, getErrorMessage, errorStatus } from "../../lib/api-helpers";

export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
    const payload = (await request.json()) as Record<string, unknown>;
    const id = await createOwner({
      document: requiredString(payload.document, "document"),
      email: requiredString(payload.email, "email"),
      name: requiredString(payload.name, "name"),
      phone: requiredString(payload.phone, "phone"),
      propertyIds: requiredStringArray(payload.propertyIds, "propertyIds"),
    });

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireApiUser(["admin"]);
    const payload = (await request.json()) as Record<string, unknown>;
    await updateOwner({
      document: requiredString(payload.document, "document"),
      email: requiredString(payload.email, "email"),
      id: requiredString(payload.id, "id"),
      name: requiredString(payload.name, "name"),
      phone: requiredString(payload.phone, "phone"),
      propertyIds: requiredStringArray(payload.propertyIds, "propertyIds"),
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireApiUser(["admin"]);
    const payload = (await request.json()) as Record<string, unknown>;
    await deleteOwner(requiredString(payload.id, "id"));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

function requiredStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} is required`);
  }
  const parsed = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (parsed.length === 0) {
    throw new Error(`${field} is required`);
  }
  return parsed;
}
