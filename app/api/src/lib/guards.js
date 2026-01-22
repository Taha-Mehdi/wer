// src/lib/guards.js
import { verifyAccessTokenFromRequest } from "@/src/lib/auth";

export function requireAuth(req) {
  const auth = verifyAccessTokenFromRequest(req);
  if (!auth.ok) return { ok: false, status: 401, json: { message: "Unauthorized" } };
  return { ok: true, user: auth.user };
}

export function requireRole(req, roleName) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth;

  const actual = auth.user?.roleName || null;
  if (!actual) return { ok: false, status: 403, json: { message: "Role not recognized" } };

  if (actual !== roleName) return { ok: false, status: 403, json: { message: "Access denied" } };

  return { ok: true, user: auth.user };
}

export function requireAnyRole(req, roleNames) {
  const auth = requireAuth(req);
  if (!auth.ok) return auth;

  const actual = auth.user?.roleName || null;
  if (!actual) return { ok: false, status: 403, json: { message: "Role not recognized" } };

  const allowed = new Set(roleNames);
  if (!allowed.has(actual)) return { ok: false, status: 403, json: { message: "Access denied" } };

  return { ok: true, user: auth.user };
}

export function isPrivileged(user) {
  const role = user?.roleName || user?.role || user?.role_name;
  return role === "admin" || role === "product_manager" || role === "sales_manager";
}
