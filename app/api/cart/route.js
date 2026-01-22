import { z } from "zod";
import { db } from "@/src/db";
import { cartItems } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/src/lib/guards";

export async function GET(req) {
  const guard = requireAuth(req);
  if (!guard.ok) return Response.json(guard.json, { status: guard.status });

  const userId = guard.user.id;

  try {
    const items = await db.select().from(cartItems).where(eq(cartItems.userId, userId));
    return Response.json(items);
  } catch (err) {
    console.error("GET /api/cart error:", err);
    return Response.json({ message: "Failed to fetch cart" }, { status: 500 });
  }
}
