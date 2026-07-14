import { requireApiUser } from "../../lib/session";
import { createReceiver, deleteReceiver, updateReceiver } from "../../lib/rental-repository";
import { requiredString, optionalString, getErrorMessage, errorStatus } from "../../lib/api-helpers";

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
