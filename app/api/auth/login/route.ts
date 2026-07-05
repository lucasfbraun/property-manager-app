import { cookies } from "next/headers";
import {
  verifyPassword,
  buildSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "../../../lib/auth";
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

    // Set the cookie two ways: via the official Next.js cookies() API (the
    // path vinext is expected to support, since it implements next/headers)
    // and by appending the raw Set-Cookie header on the response as a
    // fallback, in case one of the two mechanisms isn't fully wired up.
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: true,
    });

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
