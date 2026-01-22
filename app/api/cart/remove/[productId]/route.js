import { db } from "@/src/db";
import { cartItems } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/src/lib/guards";

export async function DELETE(req, { params }) {
  const guard = requireAuth(req);
  if (!guard.ok) return Response.json(guard.json, { status: guard.status });

  const userId = guard.user.id;
  const productId = Number(params.productId);

  if (!Number.isInteger(productId) || productId <= 0) {
    return Response.json({ message: "Invalid product id" }, { status: 400 });
  }

  try {
    const deleted = await db
      .delete(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
      .returning();

    if (deleted.length === 0) return Response.json({ message: "Item not found" }, { status: 404 });

    return Response.json({ message: "Item removed", item: deleted[0] });
  } catch (err) {
    console.error("DELETE /api/cart/remove/:productId error:", err);
    return Response.json({ message: "Failed to remove item" }, { status: 500 });
  }
}
