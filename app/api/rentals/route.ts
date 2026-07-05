import { getRentalData } from "../../lib/rental-repository";

export async function GET() {
  try {
    return Response.json(await getRentalData());
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
