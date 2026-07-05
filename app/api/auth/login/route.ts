import { verifyPassword, buildSessionCookie, SESSION_TTL_SECONDS } from "../../../lib/auth";
import {
  createSession,
  findUserByEmail,
} from "../../../lib/auth-repository";
import { ensureRentalDatabase } from "../../../lib/rental-repository";

export async function POST(request: Request) {
  try {
    await ensureRentalDatabase();
  } catch (error) {
    return Response.json(
      {
        error: `Falha ao preparar o banco de dados: ${getErrorMessage(error)}`,
      },
      { status: 500 },
    );
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const email = String(payload.email ?? "").trim().toLowerCase();
    const password = String(payload.password ?? "");

    if (!email || !password) {
      throw new Error("Informe e-mail e senha.");
    }

    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new Error("E-mail ou senha invalidos.");
    }

    const token = await createSession(user.id, SESSION_TTL_SECONDS);
    const response = Response.json({ role: user.role });
    response.headers.append(
      "Set-Cookie",
      buildSessionCookie(token, SESSION_TTL_SECONDS),
    );
    return response;
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 401 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
