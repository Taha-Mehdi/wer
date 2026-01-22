import { z } from "zod";
import { db } from "@/src/db";
import { orders } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { requireAnyRole } from "@/src/lib/guards";

const statusUpdateSchema = z.object({
  status: z.enum(["processing", "in_transit", "delivered", "cancelled", "refunded"]),
});

export async function PATCH(req, { params }) {
  const guard = requireAnyRole(req, ["admin", "product_manager"]);
  if (!guard.ok) return Response.json(guard.json, { status: guard.status });

  const orderId = Number(params.id);

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = statusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: "Invalid status", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { status } = parsed.data;
    const updated = await db.update(orders).set({ status }).where(eq(orders.id, orderId)).returning();

    if (updated.length === 0) return Response.json({ message: "Order not found" }, { status: 404 });

    return Response.json({ message: "Order status updated", order: updated[0] });
  } catch (err) {
    console.error("Admin update order status error:", err);
    return Response.json({ message: "Server error" }, { status: 500 });
  }
}
