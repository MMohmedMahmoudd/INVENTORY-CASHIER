-- =============================================================================
-- InvenPOS - Functions & Triggers
-- =============================================================================

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Auto-create user profile on sign-up ─────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_role_id UUID;
BEGIN
  SELECT id INTO default_role_id FROM roles WHERE name = 'manager' LIMIT 1;

  INSERT INTO user_profiles (auth_user_id, full_name, role_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    default_role_id
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Inventory update on sale ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION deduct_stock_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  prev_stock INTEGER;
  new_stock  INTEGER;
BEGIN
  SELECT stock_quantity INTO prev_stock FROM products WHERE id = NEW.product_id FOR UPDATE;
  IF prev_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_id;
  END IF;
  new_stock := prev_stock - NEW.quantity;
  UPDATE products SET stock_quantity = new_stock WHERE id = NEW.product_id;
  INSERT INTO inventory_transactions (product_id, type, quantity, previous_stock, new_stock, reference_type, reference_id)
  VALUES (NEW.product_id, 'sale', NEW.quantity, prev_stock, new_stock, 'sale', NEW.sale_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deduct_stock_on_sale
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION deduct_stock_on_sale();

-- ─── Inventory update on purchase received ────────────────────────────────────
CREATE OR REPLACE FUNCTION add_stock_on_purchase()
RETURNS TRIGGER AS $$
DECLARE
  prev_stock INTEGER;
  new_stock  INTEGER;
BEGIN
  IF NEW.status = 'received' AND OLD.status != 'received' THEN
    FOR prev_stock, new_stock IN
      SELECT
        p.stock_quantity,
        p.stock_quantity + pi.quantity
      FROM purchase_items pi
      JOIN products p ON p.id = pi.product_id
      WHERE pi.purchase_id = NEW.id
    LOOP
    END LOOP;

    UPDATE products p
    SET stock_quantity = p.stock_quantity + pi.quantity
    FROM purchase_items pi
    WHERE pi.purchase_id = NEW.id AND p.id = pi.product_id;

    INSERT INTO inventory_transactions (product_id, type, quantity, previous_stock, new_stock, reference_type, reference_id)
    SELECT
      pi.product_id,
      'purchase',
      pi.quantity,
      p.stock_quantity - pi.quantity,
      p.stock_quantity,
      'purchase',
      NEW.id
    FROM purchase_items pi
    JOIN products p ON p.id = pi.product_id
    WHERE pi.purchase_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_add_stock_on_purchase
  AFTER UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION add_stock_on_purchase();

-- ─── Get user permissions function ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  perms TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT p.key) INTO perms
  FROM permissions p
  WHERE p.id IN (
    -- Role-based permissions
    SELECT rp.permission_id
    FROM role_permissions rp
    JOIN user_profiles up ON up.role_id = rp.role_id
    WHERE up.id = p_user_id
    UNION
    -- User-specific permissions
    SELECT up2.permission_id
    FROM user_permissions up2
    WHERE up2.user_id = p_user_id
  );
  RETURN COALESCE(perms, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Check permission function ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_permission = ANY(get_user_permissions(p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Log activity function ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_activity(
  p_user_id     UUID,
  p_action      TEXT,
  p_entity_type TEXT,
  p_entity_id   UUID DEFAULT NULL,
  p_metadata    JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Dashboard stats function ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_revenue',    COALESCE((SELECT SUM(total) FROM sales WHERE payment_status = 'paid'), 0),
    'total_orders',     COALESCE((SELECT COUNT(*) FROM sales), 0),
    'total_products',   COALESCE((SELECT COUNT(*) FROM products WHERE is_active = TRUE), 0),
    'low_stock_count',  COALESCE((SELECT COUNT(*) FROM products WHERE stock_quantity <= minimum_stock AND is_active = TRUE), 0),
    'revenue_today',    COALESCE((SELECT SUM(total) FROM sales WHERE payment_status = 'paid' AND DATE(created_at) = CURRENT_DATE), 0),
    'orders_today',     COALESCE((SELECT COUNT(*) FROM sales WHERE DATE(created_at) = CURRENT_DATE), 0)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
