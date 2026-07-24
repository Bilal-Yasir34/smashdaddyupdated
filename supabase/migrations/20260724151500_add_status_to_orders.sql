-- Add status column to orders table with default 'Being Prepared'
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Being Prepared';
