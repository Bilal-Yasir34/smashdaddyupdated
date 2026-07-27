-- Create menu_item_ingredients junction table to link menu items to inventory items
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_required numeric(10, 2) NOT NULL DEFAULT 1 CHECK (quantity_required > 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE(menu_item_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS menu_item_ingredients_menu_item_id_idx ON menu_item_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS menu_item_ingredients_inventory_item_id_idx ON menu_item_ingredients(inventory_item_id);

ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_menu_item_ingredients" ON menu_item_ingredients;
CREATE POLICY "anon_select_menu_item_ingredients" ON menu_item_ingredients FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_menu_item_ingredients" ON menu_item_ingredients;
CREATE POLICY "anon_insert_menu_item_ingredients" ON menu_item_ingredients FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_menu_item_ingredients" ON menu_item_ingredients;
CREATE POLICY "anon_update_menu_item_ingredients" ON menu_item_ingredients FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_menu_item_ingredients" ON menu_item_ingredients;
CREATE POLICY "anon_delete_menu_item_ingredients" ON menu_item_ingredients FOR DELETE
  TO anon, authenticated USING (true);
