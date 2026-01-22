import { db } from "@/src/db";
import { products } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { requireAnyRole } from "@/src/lib/guards";
import { z } from "zod";

function parseIsActive(raw) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const lower = raw.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
  }
  return undefined;
}

function parseCategoryId(raw) {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const num = Number(raw);
  if (Number.isNaN(num)) return undefined;
  return num;
}

const productBodySchema = z.object({
  name: z.string().min(1, "Product name is required"),
  model: z.string().min(1, "Model is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
  description: z.string().min(1, "Description is required"),
  stock: z.number().int().nonnegative("Quantity in stock is required"),
  price: z.number().nonnegative("Price is required"),
  warrantyStatus: z.string().min(1, "Warranty status is required"),
  distributorInfo: z.string().min(1, "Distributor information is required"),
  isActive: z.boolean().optional().default(true),
  categoryId: z.number().int({ required_error: "Category is required" }),
  cost: z.number().nonnegative("Cost must be >= 0").optional(),
});

export async function GET(req, { params }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return Response.json({ message: "Invalid product ID" }, { status: 400 });
  }

  try {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) return Response.json({ message: "Product not found" }, { status: 404 });
    return Response.json(product);
  } catch (err) {
    console.error("GET /api/products/:id error:", err);
    return Response.json({ message: "Failed to fetch product" }, { status: 500 });
  }
}

// PUT /api/products/:id (admin OR product_manager OR sales_manager)
export async function PUT(req, { params }) {
  const guard = requireAnyRole(req, ["admin", "product_manager", "sales_manager"]);
  if (!guard.ok) return Response.json(guard.json, { status: guard.status });

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return Response.json({ message: "Invalid product ID" }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const parsed = productBodySchema.safeParse({
      name: body.name,
      model: body.model,
      serialNumber: body.serialNumber,
      description: body.description,

      stock: Number(body.stock),
      price: Number(body.price),
      warrantyStatus: body.warrantyStatus,
      distributorInfo: body.distributorInfo,

      isActive: parseIsActive(body.isActive),
      categoryId: parseCategoryId(body.categoryId),
      cost:
        body.cost !== undefined && body.cost !== null && body.cost !== ""
          ? Number(body.cost)
          : undefined,
    });

    if (!parsed.success) {
      return Response.json(
        { message: "Invalid data", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const [updated] = await db
      .update(products)
      .set({
        name: data.name,
        model: data.model,
        serialNumber: data.serialNumber,
        description: data.description,

        stock: data.stock,
        price: data.price,
        warrantyStatus: data.warrantyStatus,
        distributorInfo: data.distributorInfo,

        isActive: data.isActive,
        categoryId: data.categoryId,
        cost: data.cost ?? null,
      })
      .where(eq(products.id, id))
      .returning();

    if (!updated) {
      return Response.json({ message: "Product not found" }, { status: 404 });
    }

    return Response.json(updated);
  } catch (err) {
    console.error("PUT /api/products/:id error:", err);
    return Response.json({ message: "Failed to update product" }, { status: 500 });
  }
}

// DELETE /api/products/:id (admin OR product_manager)
export async function DELETE(req, { params }) {
  const guard = requireAnyRole(req, ["admin", "product_manager"]);
  if (!guard.ok) return Response.json(guard.json, { status: guard.status });

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return Response.json({ message: "Invalid product ID" }, { status: 400 });
  }

  try {
    const [deleted] = await db.delete(products).where(eq(products.id, id)).returning();
    if (!deleted) {
      return Response.json({ message: "Product not found" }, { status: 404 });
    }

    return Response.json({ message: "Product deleted" });
  } catch (err) {
    console.error("DELETE /api/products/:id error:", err);
    return Response.json({ message: "Failed to delete product" }, { status: 500 });
  }
}
