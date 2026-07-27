-- Add order_number column to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS order_number text DEFAULT NULL;
