import { getD1, type D1Binding } from "../../db";
import { generateToken } from "./auth";

export type AuthRole = "admin" | "receiver" | "tenant";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  tenantId: string | null;
  receiverId: string | null;
};

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: AuthRole;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: AuthRole;
};

export async function ensureAuthTables(d1: D1Binding = getD1()) {
  await d1.batch([
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY NOT NULL, name text NOT NULL, email text NOT NULL UNIQUE, password_hash text NOT NULL, role text NOT NULL, created_at text NOT NULL)",
    ),
    d1.prepare(
      "CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, expires_at text NOT NULL, created_at text NOT NULL)",
    ),
  ]);
}

/**
 * Adds `column` to `table` if it does not already exist. Tries the ALTER
 * directly and swallows the "duplicate column" error instead of relying on
 * PRAGMA table_info, since PRAGMA support can vary across D1 versions.
 */
export async function ensureColumn(
  d1: D1Binding,
  table: string,
  column: string,
  definition: string,
) {
  try {
    await d1.prepare(`ALTER TABLE ${table} ADD COLUMN ${definition}`).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/duplicate column name/i.test(message)) {
      throw new Error(
        `Falha ao adicionar coluna ${column} em ${table}: ${message}`,
      );
    }
  }
}

export async function findUserByEmail(
  email: string,
): Promise<StoredUser | null> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      "SELECT id, name, email, password_hash, role FROM users WHERE email = ?",
    )
    .bind(email)
    .first<UserRow>();

  if (!row) {
    return null;
  }

  return {
    email: row.email,
    id: row.id,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
  };
}

export async function createUser(input: {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: AuthRole;
}) {
  const d1 = getD1();
  await d1
    .prepare(
      "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      input.id,
      input.name,
      input.email,
      input.passwordHash,
      input.role,
      new Date().toISOString(),
    )
    .run();
}

export async function createSession(
  userId: string,
  ttlSeconds: number,
): Promise<string> {
  const d1 = getD1();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  await d1
    .prepare(
      "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(token, userId, expiresAt, new Date().toISOString())
    .run();

  return token;
}

export async function deleteSession(token: string) {
  const d1 = getD1();
  await d1.prepare("DELETE FROM sessions WHERE id = ?").bind(token).run();
}

export async function getSessionUser(
  token: string,
): Promise<SessionUser | null> {
  const d1 = getD1();
  const row = await d1
    .prepare(
      `SELECT u.id as id, u.name as name, u.email as email, u.role as role,
              t.id as tenant_id, r.id as receiver_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN tenants t ON t.user_id = u.id
       LEFT JOIN receivers r ON r.user_id = u.id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(token, new Date().toISOString())
    .first<{
      id: string;
      name: string;
      email: string;
      role: AuthRole;
      tenant_id: string | null;
      receiver_id: string | null;
    }>();

  if (!row) {
    return null;
  }

  return {
    email: row.email,
    id: row.id,
    name: row.name,
    receiverId: row.receiver_id,
    role: row.role,
    tenantId: row.tenant_id,
  };
}
