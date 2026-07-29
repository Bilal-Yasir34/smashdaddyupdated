/*
# Smash Daddy POS System — Expenses Schema

## Overview
Adds an expenses table so admins can record, track, and categorize restaurant expenses
from the admin panel with flexible date filtering (Today, Week, Month, Year, Custom Range)
and financial profit analysis.

## New Tables

### expenses
Stores expense transactions.
- id: UUID primary key
- title: Short title/summary of expense (e.g., "Electricity Bill", "Beef Patty Stock")
- category: Category of expense (e.g., "Ingredients", "Utilities", "Rent", "Staff", "Supplies", "Maintenance", "Marketing", "Other")
- description: Optional detailed description/notes
- amount: Amount in PKR
- expense_date: Timestamp when expense occurred (defaults to now())
- created_at / updated_at: System timestamps

## Security
- RLS enabled.
- Open policies TO anon, authenticated (consistent with single-tenant POS structure).
*/

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  description text,
  amount numeric(10, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  expense_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_expenses" ON expenses;
CREATE POLICY "anon_select_expenses" ON expenses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_expenses" ON expenses;
CREATE POLICY "anon_insert_expenses" ON expenses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_expenses" ON expenses;
CREATE POLICY "anon_update_expenses" ON expenses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_expenses" ON expenses;
CREATE POLICY "anon_delete_expenses" ON expenses FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category);
