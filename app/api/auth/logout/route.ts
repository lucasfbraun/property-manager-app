import { cookies } from "next/headers";
import { buildClearSessionCookie, SESSION_COOKIE_NAME } from "../../../lib/auth";
import { deleteSession } from "../../../lib/auth-repository";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSession(token);
  }

  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: true,
  });

  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", buildClearSessionCookie());
  return response;
}
