import { requireApiUser } from "../../lib/session";
import { hashPassword } from "../../lib/auth";
import { createId } from "../../lib/ids";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
} from "../../lib/auth-repository";
import { ensureRentalDatabase } from "../../lib/rental-repository";
import {
  errorStatus,
  getErrorMessage,
  optionalString,
  requiredString,
} from "../../lib/api-helpers";

const MIN_PASSWORD_LENGTH = 8;

function assertPasswordStrength(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
}

export async function GET() {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();
    return Response.json({ admins: await listAdminUsers() });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();
    const payload = (await request.json()) as Record<string, unknown>;

    const name = requiredString(payload.name, "name");
    const email = requiredString(payload.email, "email").toLowerCase();
    const password = requiredString(payload.password, "password");
    assertPasswordStrength(password);

    await createAdminUser({
      email,
      id: createId("usr"),
      name,
      passwordHash: await hashPassword(password),
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireApiUser(["admin"]);
    await ensureRentalDatabase();
    const payload = (await request.json()) as Record<string, unknown>;

    const id = requiredString(payload.id, "id");
    const name = requiredString(payload.name, "name");
    const email = requiredString(payload.email, "email").toLowerCase();
    const password = optionalString(payload.password);
    if (password) {
      assertPasswordStrength(password);
    }

    await updateAdminUser({
      email,
      id,
      name,
      passwordHash: password ? await hashPassword(password) : undefined,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser(["admin"]);
    await ensureRentalDatabase();
    const payload = (await request.json()) as Record<string, unknown>;
    const id = requiredString(payload.id, "id");

    await deleteAdminUser(id, user.id);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: errorStatus(error) });
  }
}
