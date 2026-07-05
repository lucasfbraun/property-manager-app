import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "./auth";
import {
  getSessionUser,
  type AuthRole,
  type SessionUser,
} from "./auth-repository";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return getSessionUser(token);
}

export function roleHomePath(role: AuthRole): string {
  if (role === "admin") return "/";
  if (role === "tenant") return "/inquilino";
  return "/recebedor";
}

/**
 * Ensures a signed-in user, redirecting to /login when absent and to the
 * role's own home page when `allowedRoles` does not include their role.
 */
export async function requireUser(
  allowedRoles?: AuthRole[],
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect(roleHomePath(user.role));
  }
  return user;
}
