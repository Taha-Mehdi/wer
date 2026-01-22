import { db } from "@/src/db";
import { orders, orderItems } from "@/src/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "@/src/lib/guards";

export async function GET(req) {
  const guard = requireAuth(req);
  if (!guard.ok) return Response.json(guard.json, { status: guard.status });

  try {
    const userId = guard.user.id;

    const userOrders = await db.select().from(orders).where(eq(orders.userId, userId));
    if (userOrders.length === 0) return Response.json({ orders: [], items: [] });

    const orderIds = userOrders.map((o) => o.id);
    const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));

    return Response.json({ orders: userOrders, items });
  } catch (err) {
    console.error("Get my orders error:", err);
    return Response.json({ message: "Server error" }, { status: 500 });
  }
}
