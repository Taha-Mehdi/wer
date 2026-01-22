import { z } from "zod";
import { db } from "@/src/db";
import { cartItems, products } from "@/src/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "@/src/lib/guards";

const addToCartSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().default(1),
});

export async function POST(req) {
  const guard = requireAuth(req);
  if (!guard.ok) return Response.json(guard.json, { status: guard.status });

  const userId = guard.user.id;

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = addToCartSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Invalid data" }, { status: 400 });
  }

  const { productId, quantity } = parsed.data;

  try {
    // 1. Check Product
    const productRows = await db.select().from(products).where(eq(products.id, productId));
    if (productRows.length === 0) {
      return Response.json({ message: "Product not found" }, { status: 404 });
    }

    const product = productRows[0];

    if (!product.isActive) {
      return Response.json({ message: "Product is not available." }, { status: 400 });
    }

    if (product.stock <= 0) {
      return Response.json({ message: "Product out of stock." }, { status: 400 });
    }

    // 2. Atomic upsert
    const result = await db
      .insert(cartItems)
      .values({ userId, productId, quantity })
      .onConflictDoUpdate({
        target: [cartItems.userId, cartItems.productId],
        set: {
          quantity: sql`${cartItems.quantity} + ${quantity}`,
        },
      })
      .returning();

    const finalItem = result[0];

    // 3. Cap to stock
    if (finalItem.quantity > product.stock) {
      await db.update(cartItems).set({ quantity: product.stock }).where(eq(cartItems.id, finalItem.id));
      finalItem.quantity = product.stock;
    }

    return Response.json(
      { message: "Cart updated", item: finalItem },
      { status: 200 }
    );
  } catch (err) {
    console.error("Cart Add Error:", err);
    return Response.json({ message: "Cart update failed" }, { status: 500 });
  }
}
