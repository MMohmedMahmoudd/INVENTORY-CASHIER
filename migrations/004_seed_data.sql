-- =============================================================================
-- InvenPOS - Seed Data
-- =============================================================================

-- ─── Roles ───────────────────────────────────────────────────────────────────
INSERT INTO roles (id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin',   'Full system administrator with all permissions'),
  ('00000000-0000-0000-0000-000000000002', 'manager', 'Store manager with limited permissions')
ON CONFLICT (name) DO NOTHING;

-- ─── Permissions ─────────────────────────────────────────────────────────────
INSERT INTO permissions (key, description) VALUES
  ('view_products',     'View product listings'),
  ('create_products',   'Create new products'),
  ('edit_products',     'Edit existing products'),
  ('delete_products',   'Delete products'),
  ('view_sales',        'View sales records'),
  ('create_sales',      'Create new sales / POS'),
  ('edit_sales',        'Edit existing sales'),
  ('delete_sales',      'Delete sales records'),
  ('view_reports',      'View analytics reports'),
  ('export_reports',    'Export reports to CSV/PDF'),
  ('manage_users',      'Create and manage users'),
  ('manage_roles',      'Create and assign roles'),
  ('manage_settings',   'Access system settings'),
  ('manage_inventory',  'Manage stock and inventory'),
  ('scan_qr_codes',     'Use QR code scanner'),
  ('manage_suppliers',  'Manage supplier records'),
  ('manage_customers',  'Manage customer records'),
  ('manage_categories', 'Manage product categories'),
  ('view_purchases',    'View purchase orders'),
  ('create_purchases',  'Create purchase orders'),
  ('view_activity_logs','View audit/activity logs')
ON CONFLICT (key) DO NOTHING;

-- ─── Assign ALL permissions to admin ─────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  '00000000-0000-0000-0000-000000000001',
  id
FROM permissions
ON CONFLICT DO NOTHING;

-- ─── Assign limited permissions to manager ────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  '00000000-0000-0000-0000-000000000002',
  id
FROM permissions
WHERE key IN (
  'view_products',
  'create_products',
  'edit_products',
  'view_sales',
  'create_sales',
  'manage_inventory',
  'scan_qr_codes',
  'manage_customers',
  'view_purchases',
  'view_reports'
)
ON CONFLICT DO NOTHING;

-- ─── Default Settings ────────────────────────────────────────────────────────
INSERT INTO settings (key, value) VALUES
  ('general',  '{"store_name":"InvenPOS Store","currency":"USD","timezone":"UTC","language":"en"}'),
  ('pos',      '{"tax_rate":0.1,"receipt_footer":"Thank you for your purchase!","allow_discount":true,"max_discount_percent":20}'),
  ('inventory','{"low_stock_alert":true,"auto_reorder":false,"default_unit":"piece"}'),
  ('receipt',  '{"show_logo":true,"show_barcode":true,"footer_text":"Thank you!"}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Add your own suppliers here
