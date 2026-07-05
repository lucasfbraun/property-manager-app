import { requireApiUser, UnauthorizedError } from "../../lib/session";
import { createProperty, deleteProperty, updateProperty } from "../../lib/rental-repository";

export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
    const payload = (await request.json()) as Record<string, unknown>;
    const id = await createProperty({
      address: requiredString(payload.address, "address"),
      name: requiredString(payload.name, "name"),
      type: requiredString(payload.type, "type"),
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
    const status = requiredString(payload.status, "status");
    if (status !== "Alugado" && status !== "Disponivel" && status !== "Manutencao") {
      throw new Error("status invalido");
    }

    await updateProperty({
      address: requiredString(payload.address, "address"),
      id: requiredString(payload.id, "id"),
      name: requiredString(payload.name, "name"),
      status,
      type: requiredString(payload.type, "type"),
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
    await deleteProperty(requiredString(payload.id, "id"));
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

function errorStatus(error: unknown) {
  return error instanceof UnauthorizedError ? 401 : 400;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
