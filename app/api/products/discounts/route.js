import { z } from "zod";
import { db } from "@/src/db";
import { products, wishlistItems, users } from "@/src/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireRole } from "@/src/lib/guards";

// TODO: this depends on your backend utils/email.js
// We'll plug this in once you send email.js
// import { sendDiscountEmail } from "@/src/utils/email";

const discountSchema = z.object({
  productIds: z.array(z.coerce.number().int().positive()).min(1),
  discountRate: z.coerce.number().min(0).max(100),
});

function round2(n) {
  return Math.round(n * 100) / 100;
}

export async function POST(req) {
  const guard = requireRole(req, "sales_manager");
  if (!guard.ok) return Response.json(guard.json, { status: guard.status });

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const parsed = discountSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { message: "Invalid data", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productIds, discountRate } = parsed.data;

    const updatedProducts = await db.transaction(async (tx) => {
      const rows = await tx.select().from(products).where(inArray(products.id, productIds));
      if (rows.length !== productIds.length) {
        throw new Error("One or more products not found");
      }

      const out = [];

      for (const p of rows) {
        const currentPrice = Number(p.price);
        const baseOriginal =
          p.originalPrice !== null && p.originalPrice !== undefined
            ? Number(p.originalPrice)
            : currentPrice;

        if (discountRate <= 0) {
          const restoredPrice =
            p.originalPrice !== null && p.originalPrice !== undefined
              ? Number(p.originalPrice)
              : currentPrice;

          const [upd] = await tx
            .update(products)
            .set({
              price: round2(restoredPrice),
              originalPrice: null,
              discountRate: null,
            })
            .where(eq(products.id, p.id))
            .returning();

          out.push(upd);
        } else {
          const newPrice = round2(baseOriginal * (1 - discountRate / 100));
          const rate2 = round2(discountRate);

          const [upd] = await tx
            .update(products)
            .set({
              originalPrice: p.originalPrice ?? baseOriginal,
              discountRate: rate2,
              price: newPrice,
            })
            .where(eq(products.id, p.id))
            .returning();

          out.push(upd);
        }
      }

      return out;
    });

    // Email notifications: we’ll re-enable once you send utils/email.js
    // (kept commented to avoid breaking your build)
    /*
    if (discountRate > 0) {
      try {
        const wishRows = await db
          .select()
          .from(wishlistItems)
          .where(inArray(wishlistItems.productId, productIds));

        if (wishRows.length > 0) {
          const byUser = new Map();
          for (const w of wishRows) {
            if (!byUser.has(w.userId)) byUser.set(w.userId, new Set());
            byUser.get(w.userId).add(w.productId);
          }

          const userIds = Array.from(byUser.keys());
          const userRows = await db.select().from(users).where(inArray(users.id, userIds));

          const productMap = new Map(updatedProducts.map((p) => [p.id, p]));

          for (const u of userRows) {
            const pids = Array.from(byUser.get(u.id) || []);
            const discounted = pids.map((pid) => productMap.get(pid)).filter(Boolean);

            if (discounted.length > 0) {
              await sendDiscountEmail(u.email, discounted, round2(discountRate));
            }
          }
        }
      } catch (notifyErr) {
        console.error("Discount notify error (ignored):", notifyErr);
      }
    }
    */

    return Response.json({
      message: discountRate > 0 ? "Discount applied" : "Discount removed",
      discountRate: round2(discountRate),
      updatedProducts,
    });
  } catch (err) {
    console.error("POST /api/products/discounts error:", err);
    const msg = err?.message || "Server error";
    if (msg === "One or more products not found") {
      return Response.json({ message: msg }, { status: 400 });
    }
    return Response.json({ message: "Server error" }, { status: 500 });
  }
}
