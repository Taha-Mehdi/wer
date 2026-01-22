import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "@/src/db";
import { users, roles } from "@/src/db/schema";
import { eq } from "drizzle-orm";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

async function getRoleNameById(roleId) {
  const rid = Number(roleId);
  if (!Number.isInteger(rid)) return null;
  const roleRows = await db.select().from(roles).where(eq(roles.id, rid));
  return roleRows.length ? roleRows[0].name : null;
}

function createAccessToken(user, roleName) {
  return jwt.sign(
    { id: user.id, email: user.email, roleId: user.roleId, roleName: roleName || null, type: "access" },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

function createRefreshToken(user, roleName) {
  return jwt.sign(
    { id: user.id, email: user.email, roleId: user.roleId, roleName: roleName || null, type: "refresh" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user, roleName) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    taxId: user.taxId,
    address: user.address,
    roleId: user.roleId,
    roleName: roleName || null,
    accountBalance: Number(user.accountBalance || 0).toFixed(2),
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { message: "Invalid data", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const found = await db.select().from(users).where(eq(users.email, email));
    if (found.length === 0) {
      return Response.json({ message: "Invalid email or password" }, { status: 401 });
    }

    const user = found[0];
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return Response.json({ message: "Invalid email or password" }, { status: 401 });
    }

    const roleName = await getRoleNameById(user.roleId);

    const token = createAccessToken(user, roleName);
    const refreshToken = createRefreshToken(user, roleName);

    return Response.json({ token, refreshToken, user: publicUser(user, roleName) });
  } catch (err) {
    console.error("Login error:", err);
    return Response.json({ message: "Server error" }, { status: 500 });
  }
}
