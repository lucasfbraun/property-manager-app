import { createReceiver, deleteReceiver } from "../../lib/rental-repository";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = await createReceiver({
      document: requiredString(payload.document, "document"),
      email: requiredString(payload.email, "email"),
      mpAccount: optionalString(payload.mpAccount) || "Conta Mercado Pago pendente",
      name: requiredString(payload.name, "name"),
    });

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    await deleteReceiver(requiredString(payload.id, "id"));
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
