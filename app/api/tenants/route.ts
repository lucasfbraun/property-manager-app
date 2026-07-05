import { createTenant, deleteTenant } from "../../lib/rental-repository";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const password = optionalString(payload.password);
    const id = await createTenant({
      document: requiredString(payload.document, "document"),
      email: requiredString(payload.email, "email"),
      name: requiredString(payload.name, "name"),
      password: password || undefined,
      whatsapp: requiredString(payload.whatsapp, "whatsapp"),
    });

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    await deleteTenant(requiredString(payload.id, "id"));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 400 });
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
