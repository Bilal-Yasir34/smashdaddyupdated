-- Add payment_status column to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';
