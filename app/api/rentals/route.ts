import { requireApiUser, UnauthorizedError } from "../../lib/session";
import { getRentalData } from "../../lib/rental-repository";

export async function GET() {
  try {
    await requireApiUser(["admin"]);
    return Response.json(await getRentalData());
  } catch (error) {
    return Response.json(
      { error: getErrorMessage(error) },
      { status: errorStatus(error) },
    );
  }
}

function errorStatus(error: unknown) {
  return error instanceof UnauthorizedError ? 401 : 500;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
