import { db } from "@/src/db";
import { users, roles } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { verifyAccessTokenFromRequest } from "@/src/lib/auth";

async function getRoleNameById(roleId) {
  const rid = Number(roleId);
  if (!Number.isInteger(rid)) return null;
  const roleRows = await db.select().from(roles).where(eq(roles.id, rid));
  return roleRows.length ? roleRows[0].name : null;
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

export async function GET(req) {
  const auth = verifyAccessTokenFromRequest(req);
  if (!auth.ok) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = auth.user.id;
    const found = await db.select().from(users).where(eq(users.id, userId));

    if (found.length === 0) {
      return Response.json({ message: "User not found" }, { status: 404 });
    }

    const user = found[0];
    let roleName = auth.user.roleName || null;
    if (!roleName) roleName = await getRoleNameById(user.roleId);

    return Response.json(publicUser(user, roleName));
  } catch (err) {
    console.error("Me error:", err);
    return Response.json({ message: "Server error" }, { status: 500 });
  }
}
