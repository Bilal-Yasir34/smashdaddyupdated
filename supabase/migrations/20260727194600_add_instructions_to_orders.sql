-- Add instructions column to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS instructions text DEFAULT NULL;
