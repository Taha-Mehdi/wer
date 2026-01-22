import jwt from "jsonwebtoken";

export function ensureString(v) {
  return typeof v === "string" ? v.trim() : "";
}

export function getBearerToken(req) {
  const h = ensureString(req.headers.get("authorization") || "");
  if (!h) return null;
  const [type, token] = h.split(" ");
  if (type?.toLowerCase() !== "bearer") return null;
  return ensureString(token) || null;
}

export function verifyAccessTokenFromRequest(req) {
  const token = getBearerToken(req);
  if (!token) return { ok: false, error: "Missing token" };

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || payload.type !== "access") return { ok: false, error: "Invalid token" };
    return { ok: true, user: payload };
  } catch {
    return { ok: false, error: "Invalid token" };
  }
}
