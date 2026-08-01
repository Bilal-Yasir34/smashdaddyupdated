-- Add table_number column to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS table_number text;
