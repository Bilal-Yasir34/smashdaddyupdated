-- Add order_type column to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'Dine In';
