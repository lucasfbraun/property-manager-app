import { createContract, deleteContract } from "../../lib/rental-repository";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const monthlyRent = requiredNumber(payload.monthlyRent, "monthlyRent");
    const dueDay = requiredNumber(payload.dueDay, "dueDay");

    if (dueDay < 1 || dueDay > 31) {
      throw new Error("dueDay must be between 1 and 31");
    }

    const id = await createContract({
      dueDay,
      endsAt: requiredString(payload.endsAt, "endsAt"),
      monthlyRent,
      propertyId: requiredString(payload.propertyId, "propertyId"),
      receiverId: requiredString(payload.receiverId, "receiverId"),
      tenantId: requiredString(payload.tenantId, "tenantId"),
    });

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    await deleteContract(requiredString(payload.id, "id"));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

function requiredString(value: unknown, field: string) {
  const parsed = typeof value === "string" ? value.trim() : "";
  if (!parsed) {
    throw new Error(`${field} is required`);
  }
  return parsed;
}

function requiredNumber(value: unknown, field: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${field} must be greater than zero`);
  }
  return parsed;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
