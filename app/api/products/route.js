import { db } from "@/src/db";
import { products } from "@/src/db/schema";
import { eq, or, ilike, asc, desc } from "drizzle-orm";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q");
    const sortBy = url.searchParams.get("sortBy");
    const sortOrder = url.searchParams.get("sortOrder");

    let query = db.select().from(products).where(eq(products.isActive, true));

    if (q && q.trim() !== "") {
      const term = `%${q.trim()}%`;
      query = query.where(or(ilike(products.name, term), ilike(products.description, term)));
    }

    if (sortBy === "price") {
      query = query.orderBy(sortOrder === "desc" ? desc(products.price) : asc(products.price));
    } else {
      query = query.orderBy(asc(products.id));
    }

    const rows = await query;
    return Response.json(rows);
  } catch (err) {
    console.error("GET /api/products error:", err);
    return Response.json({ message: "Failed to fetch products" }, { status: 500 });
  }
}
