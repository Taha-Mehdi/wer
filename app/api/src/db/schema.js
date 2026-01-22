import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  varchar,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ROLES
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// CATEGORIES
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// USERS
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  taxId: text("tax_id"),
  address: text("address"),
  roleId: integer("role_id").notNull().references(() => roles.id),
  isActive: boolean("is_active").notNull().default(true),

  // Store credit balance (for refunds to account)
  accountBalance: numeric("account_balance", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// PRODUCTS
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  model: text("model"),
  serialNumber: text("serial_number").unique(),
  description: text("description"),
  stock: integer("stock").notNull().default(0),

  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }),

  originalPrice: numeric("original_price", { precision: 10, scale: 2 }),
  discountRate: numeric("discount_rate", { precision: 5, scale: 2 }),

  warrantyStatus: text("warranty_status"),
  distributorInfo: text("distributor_info"),
  categoryId: integer("category_id").references(() => categories.id),
  imageUrl: varchar("image_url", { length: 512 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ORDERS
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"),

  paymentMethod: text("payment_method").notNull().default("credit_card"),

  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  shippingAddress: text("shipping_address").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ORDER ITEMS
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
});

// RETURN REQUESTS
export const returnRequests = pgTable(
  "return_requests",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => orders.id),
    orderItemId: integer("order_item_id").notNull().references(() => orderItems.id),
    customerId: integer("customer_id").notNull().references(() => users.id),

    status: text("status").notNull().default("requested"),
    reason: text("reason"),

    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),

    decidedBy: integer("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),

    receivedAt: timestamp("received_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),

    refundMethod: text("refund_method"),
    refundReference: text("refund_reference"),

    refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }),
  },
  (table) => ({
    uniqueOrderItem: uniqueIndex("unique_return_request_order_item").on(table.orderItemId),
  })
);

// CART ITEMS
export const cartItems = pgTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    productId: integer("product_id").notNull().references(() => products.id),
    quantity: integer("quantity").notNull().default(1),
  },
  (table) => ({
    uniqueUserProduct: uniqueIndex("unique_user_product_cart").on(table.userId, table.productId),
  })
);

// WISHLIST ITEMS
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    productId: integer("product_id").notNull().references(() => products.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserProduct: uniqueIndex("unique_user_product_wishlist").on(table.userId, table.productId),
  })
);

// REVIEWS
export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id),
    productId: integer("product_id").notNull().references(() => products.id),

    rating: integer("rating").notNull(),
    comment: text("comment"),

    status: text("status").notNull().default("none"),

    moderatedBy: integer("moderated_by").references(() => users.id),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserProductReview: uniqueIndex("unique_user_product_review").on(
      table.userId,
      table.productId
    ),
  })
);

// CHAT
export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    customerUserId: integer("customer_user_id").references(() => users.id),
    guestToken: varchar("guest_token", { length: 64 }),
    status: text("status").notNull().default("open"),
    assignedAgentId: integer("assigned_agent_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idxCustomer: index("idx_conversations_customer_user_id").on(table.customerUserId),
    idxGuestToken: index("idx_conversations_guest_token").on(table.guestToken),
    idxAssigned: index("idx_conversations_assigned_agent_id").on(table.assignedAgentId),
    idxStatus: index("idx_conversations_status").on(table.status),
  })
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id),

    senderRole: text("sender_role").notNull(),
    senderUserId: integer("sender_user_id").references(() => users.id),

    text: text("text"),

    attachmentUrl: varchar("attachment_url", { length: 1024 }),
    attachmentName: varchar("attachment_name", { length: 255 }),
    attachmentMime: varchar("attachment_mime", { length: 255 }),
    attachmentSize: integer("attachment_size"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idxConversation: index("idx_messages_conversation_id").on(table.conversationId),
    idxCreatedAt: index("idx_messages_created_at").on(table.createdAt),
  })
);
