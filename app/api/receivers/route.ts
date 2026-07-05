import { requireApiUser, UnauthorizedError } from "../../lib/session";
import { createReceiver, deleteReceiver, updateReceiver } from "../../lib/rental-repository";

export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
    const payload = (await request.json()) as Record<string, unknown>;
    const password = optionalString(payload.password);
    const id = await createReceiver({
      document: requiredString(payload.document, "document"),
      email: requiredString(payload.email, "email"),
      mpAccount: optionalString(payload.mpAccount) || "Conta Mercado Pago pendente",
      name: requiredString(payload.name, "name"),
      password: password || undefined,
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
    const password = optionalString(payload.password);

    await updateReceiver({
      document: requiredString(payload.document, "document"),
      email: requiredString(payload.email, "email"),
      id: requiredString(payload.id, "id"),
      mpAccount: optionalString(payload.mpAccount) || "Conta Mercado Pago pendente",
      name: requiredString(payload.name, "name"),
      password: password || undefined,
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
    await deleteReceiver(requiredString(payload.id, "id"));
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
