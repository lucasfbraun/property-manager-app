// Pure crypto + cookie helpers for authentication. No Next.js or database
// imports here so this stays usable from any runtime (Workers, tests, etc).

const PBKDF2_ITERATIONS = 100_000;

export const SESSION_COOKIE_NAME = "session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
}

function toHex(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Hashes a password using PBKDF2-SHA256 with a random salt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(derived)}`;
}

/** Verifies a password against a hash produced by hashPassword. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    return false;
  }

  const [iterationsRaw, saltHex, hashHex] = parts;
  const iterations = Number.parseInt(iterationsRaw, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const salt = fromHex(saltHex);
  const derived = await deriveBits(password, salt, iterations);
  return timingSafeEqualHex(toHex(derived), hashHex);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Generates a random, unguessable session token. */
export function generateToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export function buildSessionCookie(
  token: string,
  maxAgeSeconds: number = SESSION_TTL_SECONDS,
): string {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
