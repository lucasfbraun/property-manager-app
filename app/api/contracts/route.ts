import { requireApiUser } from "../../lib/session";
import { createContract, deleteContract, updateContract } from "../../lib/rental-repository";
import { sendContractExpiringReminder } from "../../lib/reminders";
import { requiredString, getErrorMessage, errorStatus } from "../../lib/api-helpers";

export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
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
      witnessIds: optionalStringArray(payload.witnessIds),
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
    const monthlyRent = requiredNumber(payload.monthlyRent, "monthlyRent");
    const dueDay = requiredNumber(payload.dueDay, "dueDay");
    if (dueDay < 1 || dueDay > 31) {
      throw new Error("dueDay must be between 1 and 31");
    }

    const status = requiredString(payload.status, "status");
    if (status !== "Ativo" && status !== "Vence em breve" && status !== "Encerrado") {
      throw new Error("status invalido");
    }

    const fineRate = requiredNumber(payload.fineRate, "fineRate", { allowZero: true });
    const monthlyInterestRate = requiredNumber(
      payload.monthlyInterestRate,
      "monthlyInterestRate",
      { allowZero: true },
    );
    const graceDays = requiredNumber(payload.graceDays, "graceDays", { allowZero: true });

    const contractId = requiredString(payload.id, "id");
    await updateContract({
      dueDay,
      endsAt: requiredString(payload.endsAt, "endsAt"),
      fineRate,
      graceDays,
      id: contractId,
      monthlyInterestRate,
      monthlyRent,
      status,
      witnessIds: optionalStringArray(payload.witnessIds),
    });

    if (status === "Vence em breve") {
      try {
        await sendContractExpiringReminder(contractId);
      } catch (whatsappError) {
        console.error("[contracts] falha ao notificar contrato vencendo por whatsapp:", whatsappError);
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireApiUser(["admin"]);
    const payload = (await request.json()) as Record<string, unknown>;
    await deleteContract(requiredString(payload.id, "id"));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function requiredNumber(
  value: unknown,
  field: string,
  options: { allowZero?: boolean } = {},
) {
  const parsed = typeof value === "number" ? value : Number(value);
  const minimum = options.allowZero ? 0 : Number.EPSILON;
  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new Error(
      options.allowZero
        ? `${field} must be zero or greater`
        : `${field} must be greater than zero`,
    );
  }
  return parsed;
}
