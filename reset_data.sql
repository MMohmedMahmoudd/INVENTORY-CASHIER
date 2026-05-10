-- =============================================================================
-- InvenPOS – Full Data Reset Script
-- Paste into Supabase SQL Editor and click Run.
-- Wipes: products, variants, sales, purchases, inventory, categories, suppliers.
-- Preserves: roles, permissions, settings, user accounts.
-- =============================================================================

-- 1. Sale items first (product_id ON DELETE RESTRICT blocks products delete)
DELETE FROM sale_items;
DELETE FROM sales;

-- 2. Purchase items first (same reason)
DELETE FROM purchase_items;
DELETE FROM purchases;

-- 3. Inventory transactions
DELETE FROM inventory_transactions;

-- 4. QR codes
DELETE FROM product_qr_codes;

-- 5. Product variants (new table — safe to delete even if table doesn't exist yet)
DELETE FROM product_variants;

-- 6. Products — now safe to delete
DELETE FROM products;

-- 7. Categories — remove all dummy categories so you can add your own
DELETE FROM categories;

-- 8. Suppliers — remove dummy suppliers
DELETE FROM suppliers;

-- 9. Activity logs
DELETE FROM activity_logs;

-- ─── Verify ──────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM products)              AS products,
  (SELECT COUNT(*) FROM product_variants)      AS variants,
  (SELECT COUNT(*) FROM sales)                 AS sales,
  (SELECT COUNT(*) FROM purchases)             AS purchases,
  (SELECT COUNT(*) FROM inventory_transactions)AS transactions,
  (SELECT COUNT(*) FROM categories)            AS categories,
  (SELECT COUNT(*) FROM suppliers)             AS suppliers,
  (SELECT COUNT(*) FROM roles)                 AS roles_preserved,
  (SELECT COUNT(*) FROM settings)              AS settings_preserved;
