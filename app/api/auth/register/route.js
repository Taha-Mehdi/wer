import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "@/src/db";
import { users, roles } from "@/src/db/schema";
import { eq } from "drizzle-orm";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  taxId: z.string().min(1),
  address: z.string().min(1),
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
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { message: "Invalid data", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, fullName, taxId, address } = parsed.data;

    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      return Response.json({ message: "Email already registered" }, { status: 409 });
    }

    const roleRows = await db.select().from(roles).where(eq(roles.name, "customer"));
    if (roleRows.length === 0) {
      return Response.json({ message: "Default role not configured" }, { status: 500 });
    }

    const customerRole = roleRows[0];
    const passwordHash = await bcrypt.hash(password, 10);

    const inserted = await db
      .insert(users)
      .values({ email, passwordHash, fullName, taxId, address, roleId: customerRole.id })
      .returning();

    const user = inserted[0];
    const roleName = await getRoleNameById(user.roleId);

    const token = createAccessToken(user, roleName);
    const refreshToken = createRefreshToken(user, roleName);

    return Response.json(
      { token, refreshToken, user: publicUser(user, roleName) },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return Response.json({ message: "Server error" }, { status: 500 });
  }
}
