-- =============================================================================
-- InvenPOS – Product Variants (Shoe Sizes, Colors, Styles)
-- =============================================================================

-- ─── Core variants table ─────────────────────────────────────────────────────
CREATE TABLE product_variants (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size           TEXT,
  color          TEXT,
  style          TEXT,
  sku            TEXT NOT NULL UNIQUE,
  barcode        TEXT UNIQUE,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  cost_price     NUMERIC(12,2),    -- NULL = inherit parent product price
  selling_price  NUMERIC(12,2),    -- NULL = inherit parent product price
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT non_negative_variant_stock CHECK (stock_quantity >= 0),
  -- Each size/color/style combination must be unique per product (NULLs treated as distinct values)
  UNIQUE NULLS NOT DISTINCT (product_id, size, color, style)
);

CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku     ON product_variants(sku);
CREATE INDEX idx_product_variants_active  ON product_variants(is_active);

-- ─── updated_at trigger for variants ─────────────────────────────────────────
CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Sync parent product stock from variants total ────────────────────────────
-- When any variant's stock changes, the parent product.stock_quantity = SUM(variants)
CREATE OR REPLACE FUNCTION sync_product_stock_from_variants()
RETURNS TRIGGER AS $$
DECLARE
  pid UUID;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE products
  SET stock_quantity = (
    SELECT COALESCE(SUM(stock_quantity), 0)
    FROM product_variants
    WHERE product_id = pid
  )
  WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_product_stock
  AFTER INSERT OR UPDATE OF stock_quantity OR DELETE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION sync_product_stock_from_variants();

-- ─── Add variant_id to sale_items ─────────────────────────────────────────────
ALTER TABLE sale_items
  ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;

CREATE INDEX idx_sale_items_variant ON sale_items(variant_id);

-- ─── Update deduct_stock_on_sale to handle variant-level stock ────────────────
CREATE OR REPLACE FUNCTION deduct_stock_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  prev_stock INTEGER;
  new_stock  INTEGER;
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    -- Variant sale: deduct from the specific variant
    -- The trg_sync_product_stock trigger will update the parent product automatically
    SELECT stock_quantity INTO prev_stock
      FROM product_variants WHERE id = NEW.variant_id FOR UPDATE;

    IF prev_stock < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for this variant (available: %)', prev_stock;
    END IF;

    new_stock := prev_stock - NEW.quantity;
    UPDATE product_variants SET stock_quantity = new_stock WHERE id = NEW.variant_id;

    INSERT INTO inventory_transactions
      (product_id, type, quantity, previous_stock, new_stock, reference_type, reference_id)
    VALUES
      (NEW.product_id, 'sale', NEW.quantity, prev_stock, new_stock, 'sale', NEW.sale_id);
  ELSE
    -- Non-variant sale: existing behavior
    SELECT stock_quantity INTO prev_stock FROM products WHERE id = NEW.product_id FOR UPDATE;

    IF prev_stock < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_id;
    END IF;

    new_stock := prev_stock - NEW.quantity;
    UPDATE products SET stock_quantity = new_stock WHERE id = NEW.product_id;

    INSERT INTO inventory_transactions
      (product_id, type, quantity, previous_stock, new_stock, reference_type, reference_id)
    VALUES
      (NEW.product_id, 'sale', NEW.quantity, prev_stock, new_stock, 'sale', NEW.sale_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace the old trigger (function body is replaced with CREATE OR REPLACE above)
DROP TRIGGER IF EXISTS trg_deduct_stock_on_sale ON sale_items;
CREATE TRIGGER trg_deduct_stock_on_sale
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION deduct_stock_on_sale();
