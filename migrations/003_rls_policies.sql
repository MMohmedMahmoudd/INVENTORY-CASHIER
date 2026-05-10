-- =============================================================================
-- InvenPOS - Row Level Security Policies
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_qr_codes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales                ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases            ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings             ENABLE ROW LEVEL SECURITY;

-- ─── Helper: get current user profile id ─────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_user_profile_id()
RETURNS UUID AS $$
  SELECT id FROM user_profiles WHERE auth_user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─── Helper: check if current user is admin ───────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN roles r ON r.id = up.role_id
    WHERE up.auth_user_id = auth.uid() AND r.name = 'admin'
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─── Helper: check if authenticated user has permission ───────────────────────
CREATE OR REPLACE FUNCTION current_user_has_permission(p_permission TEXT)
RETURNS BOOLEAN AS $$
  SELECT has_permission(auth_user_profile_id(), p_permission)
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- =============================================================================
-- USER_PROFILES policies
-- =============================================================================
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON user_profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Admins can manage all profiles"
  ON user_profiles FOR ALL
  USING (is_admin());

-- =============================================================================
-- ROLES policies
-- =============================================================================
CREATE POLICY "Authenticated users can read roles"
  ON roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL
  USING (is_admin());

-- =============================================================================
-- PERMISSIONS policies
-- =============================================================================
CREATE POLICY "Authenticated users can read permissions"
  ON permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage permissions"
  ON permissions FOR ALL
  USING (is_admin());

-- =============================================================================
-- ROLE_PERMISSIONS policies
-- =============================================================================
CREATE POLICY "Authenticated users can read role_permissions"
  ON role_permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage role_permissions"
  ON role_permissions FOR ALL
  USING (is_admin());

-- =============================================================================
-- USER_PERMISSIONS policies
-- =============================================================================
CREATE POLICY "Users can read own user_permissions"
  ON user_permissions FOR SELECT
  USING (user_id = auth_user_profile_id());

CREATE POLICY "Admins can manage user_permissions"
  ON user_permissions FOR ALL
  USING (is_admin());

-- =============================================================================
-- CATEGORIES policies
-- =============================================================================
CREATE POLICY "Authenticated users can read categories"
  ON categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitted users can manage categories"
  ON categories FOR ALL
  USING (current_user_has_permission('manage_categories') OR is_admin());

-- =============================================================================
-- SUPPLIERS policies
-- =============================================================================
CREATE POLICY "Authenticated users can read suppliers"
  ON suppliers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitted users can manage suppliers"
  ON suppliers FOR ALL
  USING (current_user_has_permission('manage_suppliers') OR is_admin());

-- =============================================================================
-- CUSTOMERS policies
-- =============================================================================
CREATE POLICY "Authenticated users can read customers"
  ON customers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitted users can manage customers"
  ON customers FOR ALL
  USING (current_user_has_permission('manage_customers') OR is_admin());

-- =============================================================================
-- PRODUCTS policies
-- =============================================================================
CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitted users can create products"
  ON products FOR INSERT
  WITH CHECK (current_user_has_permission('create_products') OR is_admin());

CREATE POLICY "Permitted users can update products"
  ON products FOR UPDATE
  USING (current_user_has_permission('edit_products') OR is_admin());

CREATE POLICY "Permitted users can delete products"
  ON products FOR DELETE
  USING (current_user_has_permission('delete_products') OR is_admin());

-- =============================================================================
-- PRODUCT_QR_CODES policies
-- =============================================================================
CREATE POLICY "Authenticated users can view qr_codes"
  ON product_qr_codes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitted users can manage qr_codes"
  ON product_qr_codes FOR ALL
  USING (current_user_has_permission('create_products') OR is_admin());

-- =============================================================================
-- INVENTORY_TRANSACTIONS policies
-- =============================================================================
CREATE POLICY "Permitted users can view inventory transactions"
  ON inventory_transactions FOR SELECT
  USING (current_user_has_permission('manage_inventory') OR is_admin());

CREATE POLICY "Permitted users can create inventory transactions"
  ON inventory_transactions FOR INSERT
  WITH CHECK (current_user_has_permission('manage_inventory') OR is_admin());

-- =============================================================================
-- SALES policies
-- =============================================================================
CREATE POLICY "Permitted users can view sales"
  ON sales FOR SELECT
  USING (current_user_has_permission('view_sales') OR is_admin());

CREATE POLICY "Permitted users can create sales"
  ON sales FOR INSERT
  WITH CHECK (current_user_has_permission('create_sales') OR is_admin());

CREATE POLICY "Admins can manage all sales"
  ON sales FOR ALL
  USING (is_admin());

-- =============================================================================
-- SALE_ITEMS policies
-- =============================================================================
CREATE POLICY "Permitted users can view sale items"
  ON sale_items FOR SELECT
  USING (current_user_has_permission('view_sales') OR is_admin());

CREATE POLICY "Permitted users can create sale items"
  ON sale_items FOR INSERT
  WITH CHECK (current_user_has_permission('create_sales') OR is_admin());

-- =============================================================================
-- PURCHASES policies
-- =============================================================================
CREATE POLICY "Permitted users can view purchases"
  ON purchases FOR SELECT
  USING (current_user_has_permission('view_purchases') OR is_admin());

CREATE POLICY "Permitted users can manage purchases"
  ON purchases FOR ALL
  USING (current_user_has_permission('create_purchases') OR is_admin());

-- =============================================================================
-- PURCHASE_ITEMS policies
-- =============================================================================
CREATE POLICY "Permitted users can view purchase items"
  ON purchase_items FOR SELECT
  USING (current_user_has_permission('view_purchases') OR is_admin());

CREATE POLICY "Permitted users can manage purchase items"
  ON purchase_items FOR ALL
  USING (current_user_has_permission('create_purchases') OR is_admin());

-- =============================================================================
-- ACTIVITY_LOGS policies
-- =============================================================================
CREATE POLICY "Permitted users can view activity logs"
  ON activity_logs FOR SELECT
  USING (current_user_has_permission('view_activity_logs') OR is_admin());

CREATE POLICY "System can insert activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (TRUE);

-- =============================================================================
-- SETTINGS policies
-- =============================================================================
CREATE POLICY "Authenticated users can read settings"
  ON settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage settings"
  ON settings FOR ALL
  USING (is_admin() OR current_user_has_permission('manage_settings'));
