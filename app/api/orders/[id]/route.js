import { z } from "zod";
import { db } from "@/src/db";
import { orders, orderItems } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { requireAnyRole } from "@/src/lib/guards";

export async function GET(req, { params }) {
  const guard = requireAnyRole(req, ["admin", "product_manager"]);
  if (!guard.ok) return Response.json(guard.json, { status: guard.status });

  const orderId = Number(params.id);
  if (!Number.isInteger(orderId)) {
    return Response.json({ message: "Invalid order id" }, { status: 400 });
  }

  try {
    const foundOrders = await db.select().from(orders).where(eq(orders.id, orderId));
    if (foundOrders.length === 0) return Response.json({ message: "Order not found" }, { status: 404 });

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

    return Response.json({ order: foundOrders[0], items });
  } catch (err) {
    console.error("Admin get order error:", err);
    return Response.json({ message: "Server error" }, { status: 500 });
  }
}
