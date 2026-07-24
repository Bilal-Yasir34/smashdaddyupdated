-- Add subtotal, discount_percent, and discount_amount columns to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS subtotal numeric(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10, 2) DEFAULT 0;
