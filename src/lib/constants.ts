export const APP_NAME = "InvenPOS";
export const APP_DESCRIPTION = "Enterprise Inventory & POS Management System";
export const APP_VERSION = "1.0.0";

export const PERMISSIONS = {
  VIEW_PRODUCTS: "view_products",
  CREATE_PRODUCTS: "create_products",
  EDIT_PRODUCTS: "edit_products",
  DELETE_PRODUCTS: "delete_products",
  VIEW_SALES: "view_sales",
  CREATE_SALES: "create_sales",
  EDIT_SALES: "edit_sales",
  DELETE_SALES: "delete_sales",
  VIEW_REPORTS: "view_reports",
  EXPORT_REPORTS: "export_reports",
  MANAGE_USERS: "manage_users",
  MANAGE_ROLES: "manage_roles",
  MANAGE_SETTINGS: "manage_settings",
  MANAGE_INVENTORY: "manage_inventory",
  SCAN_QR_CODES: "scan_qr_codes",
  MANAGE_SUPPLIERS: "manage_suppliers",
  MANAGE_CUSTOMERS: "manage_customers",
  MANAGE_CATEGORIES: "manage_categories",
  VIEW_PURCHASES: "view_purchases",
  CREATE_PURCHASES: "create_purchases",
  VIEW_ACTIVITY_LOGS: "view_activity_logs",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
} as const;

export const DEFAULT_PAGE_SIZE = 20;
export const TAX_RATE = 0.1;

export const PAYMENT_METHODS = [
  { label: "Cash", value: "cash" },
  { label: "Card", value: "card" },
  { label: "Wallet", value: "wallet" },
] as const;

export const PURCHASE_STATUSES = [
  { label: "Pending", value: "pending" },
  { label: "Received", value: "received" },
  { label: "Cancelled", value: "cancelled" },
] as const;

export const INVENTORY_TRANSACTION_TYPES = [
  { label: "Purchase", value: "purchase" },
  { label: "Sale", value: "sale" },
  { label: "Adjustment", value: "adjustment" },
  { label: "Return", value: "return" },
  { label: "Transfer", value: "transfer" },
] as const;

export const UNITS = [
  "piece",
  "kg",
  "gram",
  "liter",
  "ml",
  "box",
  "pack",
  "pair",
  "set",
  "dozen",
  "meter",
  "yard",
];

export const NAV_ITEMS = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    permission: null,
  },
  {
    title: "Inventory",
    icon: "Package",
    permission: null,
    children: [
      { title: "Products", href: "/products", icon: "ShoppingBag", permission: PERMISSIONS.VIEW_PRODUCTS },
      { title: "Categories", href: "/categories", icon: "Tag", permission: PERMISSIONS.MANAGE_CATEGORIES },
      { title: "Suppliers", href: "/suppliers", icon: "Truck", permission: PERMISSIONS.MANAGE_SUPPLIERS },
      { title: "Inventory", href: "/inventory", icon: "Warehouse", permission: PERMISSIONS.MANAGE_INVENTORY },
      { title: "Inventory Logs", href: "/inventory/logs", icon: "FileText", permission: PERMISSIONS.MANAGE_INVENTORY },
    ],
  },
  {
    title: "Sales",
    icon: "ShoppingCart",
    permission: null,
    children: [
      { title: "POS / Cashier", href: "/pos", icon: "Monitor", permission: PERMISSIONS.CREATE_SALES },
      { title: "Sales History", href: "/sales", icon: "Receipt", permission: PERMISSIONS.VIEW_SALES },
      { title: "Customers", href: "/customers", icon: "Users", permission: PERMISSIONS.MANAGE_CUSTOMERS },
    ],
  },
  {
    title: "Purchasing",
    icon: "PackageOpen",
    permission: null,
    children: [
      { title: "Purchases", href: "/purchases", icon: "PackagePlus", permission: PERMISSIONS.VIEW_PURCHASES },
    ],
  },
  {
    title: "QR Codes",
    icon: "QrCode",
    permission: null,
    children: [
      { title: "QR Generator", href: "/qr/generator", icon: "QrCode", permission: PERMISSIONS.VIEW_PRODUCTS },
      { title: "QR Scanner", href: "/qr/scanner", icon: "Scan", permission: PERMISSIONS.SCAN_QR_CODES },
    ],
  },
  {
    title: "Analytics",
    icon: "BarChart3",
    permission: null,
    children: [
      { title: "Reports", href: "/reports", icon: "PieChart", permission: PERMISSIONS.VIEW_REPORTS },
      { title: "Activity Logs", href: "/activity-logs", icon: "Activity", permission: PERMISSIONS.VIEW_ACTIVITY_LOGS },
    ],
  },
  {
    title: "Administration",
    icon: "Shield",
    permission: PERMISSIONS.MANAGE_USERS,
    children: [
      { title: "Users", href: "/users", icon: "UserCog", permission: PERMISSIONS.MANAGE_USERS },
      { title: "Roles", href: "/roles", icon: "Key", permission: PERMISSIONS.MANAGE_ROLES },
      { title: "Permissions", href: "/permissions", icon: "Lock", permission: PERMISSIONS.MANAGE_ROLES },
    ],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: "Settings",
    permission: PERMISSIONS.MANAGE_SETTINGS,
  },
] as const;
