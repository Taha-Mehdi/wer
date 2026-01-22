import { z } from "zod";
import { db } from "@/src/db";
import { orders, orderItems, products, users, cartItems } from "@/src/db/schema";
import { eq, inArray, and, sql } from "drizzle-orm";
import { requireAuth, requireAnyRole } from "@/src/lib/guards";

const orderItemInputSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
});

const orderCreateSchema = z.object({
  items: z.array(orderItemInputSchema).min(1),
  shippingAddress: z.string().min(5).max(500).optional(),
  paymentMethod: z.enum(["credit_card", "account"]).optional(),
});

function computePurchaseUnitPrice(productRow) {
  const price = Number(productRow?.price);
  const originalPrice = Number(productRow?.originalPrice);
  const discountRate = Number(productRow?.discountRate);

  const hasDiscount =
    Number.isFinite(originalPrice) &&
    originalPrice > 0 &&
    Number.isFinite(discountRate) &&
    discountRate > 0;

  if (hasDiscount) {
    const discounted = originalPrice * (1 - discountRate / 100);
    if (Number.isFinite(discounted) && discounted >= 0) return discounted;
  }

  return Number.isFinite(price) ? price : 0;
}

export async function POST(req) {
  const guard = requireAuth(req);
  if (!guard.ok) return Response.json(guard.json, { status: guard.status });

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = orderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: "Invalid data", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const userId = guard.user.id;
  const { items, shippingAddress } = parsed.data;
  const paymentMethod = (parsed.data.paymentMethod || "credit_card").toLowerCase();

  try {
    const result = await db.transaction(async (tx) => {
      const productIds = [...new Set(items.map((i) => i.productId))];

      const dbProducts = await tx.select().from(products).where(inArray(products.id, productIds));
      if (dbProducts.length !== productIds.length) {
        throw new Error("One or more products not found");
      }

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));

      let total = 0;

      for (const item of items) {
        const p = productMap.get(item.productId);
        if (!p || !p.isActive) throw new Error(`Product ${item.productId} is not available`);
        if (p.stock < item.quantity) throw new Error(`Not enough stock for product ${p.name}`);

        const unitPriceNumber = computePurchaseUnitPrice(p);
        total += unitPriceNumber * item.quantity;
      }

      const userRows = await tx.select().from(users).where(eq(users.id, userId));
      const userInfo = userRows[0];

      const finalShippingAddress = shippingAddress || userInfo?.address || "";

      if (paymentMethod === "account") {
        const bal = Number(userInfo?.accountBalance || 0);
        if (bal < total) {
          return { error: { status: 409, message: "Insufficient account balance." } };
        }

        await tx
          .update(users)
          .set({ accountBalance: sql`${users.accountBalance} - ${total}` })
          .where(eq(users.id, userId));
      }

      const insertedOrders = await tx
        .insert(orders)
        .values({
          userId,
          status: "processing",
          total: total.toFixed(2),
          shippingAddress: finalShippingAddress,
          paymentMethod: paymentMethod === "account" ? "account" : "credit_card",
        })
        .returning();

      const order = insertedOrders[0];

      const orderItemsToInsert = items.map((item) => {
        const p = productMap.get(item.productId);
        const unitPriceNumber = computePurchaseUnitPrice(p);
        return {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: unitPriceNumber.toFixed(2),
        };
      });

      await tx.insert(orderItems).values(orderItemsToInsert);

      for (const item of items) {
        const updated = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${item.quantity}` })
          .where(
            and(
              eq(products.id, item.productId),
              eq(products.isActive, true),
              sql`${products.stock} >= ${item.quantity}`
            )
          )
          .returning({ id: products.id });

        if (updated.length === 0) {
          throw new Error(`Not enough stock for product ${item.productId}`);
        }
      }

      await tx.delete(cartItems).where(eq(cartItems.userId, userId));

      return { order, orderItemsToInsert, userInfo };
    });

    if (result?.error) {
      return Response.json({ message: result.error.message }, { status: result.error.status });
    }

    const { order } = result;

    // TODO: plug invoice/email back once you send invoice.js + email.js
    // buildInvoicePdf(order, userInfo, orderItemsToInsert)
    // sendInvoiceEmail(userInfo.email, pdfBuffer, order.id)

    return Response.json(
      {
        message: "Order created",
        orderId: order.id,
        total: order.total,
        status: order.status,
        paymentMethod: order.paymentMethod,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create order error:", err);
    const msg = err?.message || "Server error";

    if (
      msg.startsWith("One or more products not found") ||
      msg.startsWith("Product ") ||
      msg.startsWith("Not enough stock")
    ) {
      return Response.json({ message: msg }, { status: 400 });
    }

    return Response.json({ message: "Server error" }, { status: 500 });
  }
}

// GET /api/orders (admin/product_manager)
export async function GET(req) {
  const guard = requireAnyRole(req, ["admin", "product_manager"]);
  if (!guard.ok) return Response.json(guard.json, { status: guard.status });

  try {
    const allOrders = await db.select().from(orders);
    return Response.json(allOrders);
  } catch (err) {
    console.error("Admin list orders error:", err);
    return Response.json({ message: "Server error" }, { status: 500 });
  }
}
