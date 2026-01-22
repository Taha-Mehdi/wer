import jwt from "jsonwebtoken";
import { db } from "@/src/db";
import { users, roles } from "@/src/db/schema";
import { eq } from "drizzle-orm";

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
  const body = await req.json().catch(() => ({}));
  const refreshToken = body?.refreshToken;

  if (!refreshToken) {
    return Response.json({ message: "Refresh token is required" }, { status: 400 });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (!payload || payload.type !== "refresh") {
      return Response.json({ message: "Invalid refresh token" }, { status: 401 });
    }

    const found = await db.select().from(users).where(eq(users.id, payload.id));
    if (found.length === 0) {
      return Response.json({ message: "User not found" }, { status: 404 });
    }

    const user = found[0];
    const roleName = await getRoleNameById(user.roleId);

    const newAccessToken = createAccessToken(user, roleName);
    const newRefreshToken = createRefreshToken(user, roleName);

    return Response.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: publicUser(user, roleName),
    });
  } catch (err) {
    if (err?.name === "TokenExpiredError") {
      return Response.json({ message: "Refresh token expired" }, { status: 401 });
    }
    return Response.json({ message: "Invalid refresh token" }, { status: 401 });
  }
}
