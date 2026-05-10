export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  profile?: UserProfile;
  role?: Role;
  permissions: string[];
}

// ─── Roles & Permissions ─────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
}

export interface UserPermission {
  user_id: string;
  permission_id: string;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  avatar_url: string | null;
  role_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  role?: Role;
}

export interface UserWithProfile {
  id: string;
  email: string;
  profile: UserProfile;
  role?: Role;
  permissions?: Permission[];
}

// ─── Category ────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  _count?: { products: number };
}

// ─── Supplier ────────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

// ─── Customer ────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

// ─── Product Variant (shoe sizes, colors, styles) ────────────────────────────

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  style: string | null;
  sku: string;
  barcode: string | null;
  stock_quantity: number;
  cost_price: number | null;    // null = inherit from parent product
  selling_price: number | null; // null = inherit from parent product
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Product ─────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode: string | null;
  qr_code: string | null;
  category_id: string | null;
  supplier_id: string | null;
  image_url: string | null;
  description: string | null;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  minimum_stock: number;
  unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
  supplier?: Supplier;
  variants?: ProductVariant[];
}

export interface ProductQRCode {
  id: string;
  product_id: string;
  qr_value: string;
  qr_image_url: string | null;
  created_at: string;
  product?: Product;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export type InventoryTransactionType = "purchase" | "sale" | "adjustment" | "return" | "transfer";

export interface InventoryTransaction {
  id: string;
  product_id: string;
  type: InventoryTransactionType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
  product?: Product;
  user?: UserProfile;
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export type PaymentMethod = "cash" | "card" | "wallet";
export type PaymentStatus = "paid" | "pending" | "refunded";

export interface Sale {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  cashier_id: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  created_at: string;
  customer?: Customer;
  cashier?: UserProfile;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  product?: Product;
  variant?: ProductVariant;
}

// ─── Purchases ───────────────────────────────────────────────────────────────

export type PurchaseStatus = "pending" | "received" | "cancelled";

export interface Purchase {
  id: string;
  supplier_id: string | null;
  total: number;
  status: PurchaseStatus;
  created_by: string | null;
  created_at: string;
  supplier?: Supplier;
  items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  cost_price: number;
  total: number;
  product?: Product;
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Json;
  created_at: string;
  user?: UserProfile;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface Setting {
  id: string;
  key: string;
  value: Json;
}

// ─── POS / Cart ──────────────────────────────────────────────────────────────

export interface CartItem {
  product: Product;
  variant?: ProductVariant; // set when the product has shoe/clothing variants
  quantity: number;
  unit_price: number;
  total: number;
  discount: number;
}

export interface Cart {
  items: CartItem[];
  customer: Customer | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_revenue: number;
  total_orders: number;
  total_products: number;
  low_stock_count: number;
  revenue_change: number;
  orders_change: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

// ─── Table / Pagination ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TableFilters {
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  [key: string]: unknown;
}

// ─── Forms ───────────────────────────────────────────────────────────────────

export type FormMode = "create" | "edit";

export interface SelectOption {
  label: string;
  value: string;
}
