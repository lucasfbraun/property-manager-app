import { cookies } from "next/headers";
import { buildClearSessionCookie, SESSION_COOKIE_NAME } from "../../../lib/auth";
import { deleteSession } from "../../../lib/auth-repository";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSession(token);
  }

  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", buildClearSessionCookie());
  return response;
}
