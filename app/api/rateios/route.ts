import { requireApiUser, UnauthorizedError } from "../../lib/session";
import { createRateio, listRateios } from "../../lib/rateios";
import { ensureRentalDatabase } from "../../lib/rental-repository";

export async function GET() {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();
    return Response.json({ rateios: await listRateios() });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();
    const payload = (await request.json()) as Record<string, unknown>;

    const category = requiredString(payload.category, "category");
    const description = optionalString(payload.description);
    const reference = requiredString(payload.reference, "reference");
    const totalAmount = Number(payload.totalAmount);
    const propertyIds = Array.isArray(payload.propertyIds)
      ? payload.propertyIds.filter((value): value is string => typeof value === "string")
      : [];
    const splitMode = payload.splitMode === "residents" ? "residents" : "equal";

    const result = await createRateio({
      category,
      description,
      invoiceBase64: optionalString(payload.invoiceBase64),
      invoiceContentType: optionalString(payload.invoiceContentType),
      invoiceFileName: optionalString(payload.invoiceFileName),
      propertyIds,
      reference,
      splitMode,
      totalAmount,
    });

    return Response.json(result, { status: 201 });
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

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function errorStatus(error: unknown) {
  return error instanceof UnauthorizedError ? 401 : 400;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
