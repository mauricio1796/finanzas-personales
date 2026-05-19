-- Migration 002: Subcategories support
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Add parent_category_id column to categories table
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_category_id text
    REFERENCES categories(id) ON DELETE SET NULL;

-- Index for fast lookup of subcategories by parent
CREATE INDEX IF NOT EXISTS idx_categories_parent
  ON categories (parent_category_id)
  WHERE parent_category_id IS NOT NULL;

-- 2. Add subcategory column to transactions table
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS subcategory text;

-- Index for subcategory lookups
CREATE INDEX IF NOT EXISTS idx_transactions_subcategory
  ON transactions (subcategory)
  WHERE subcategory IS NOT NULL;

-- 3. Update upsert_transaction_safe RPC to accept subcategory parameter
-- (Drop and recreate the function with the new parameter)
CREATE OR REPLACE FUNCTION upsert_transaction_safe(
  p_id          text,
  p_user_id     uuid,
  p_amount      numeric,
  p_category    text,
  p_date        text,
  p_type        text,
  p_description text,
  p_updated_at  timestamptz,
  p_subcategory text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO transactions (id, user_id, amount, category, date, type, description, subcategory, updated_at)
  VALUES (p_id, p_user_id, p_amount, p_category, p_date, p_type, p_description, p_subcategory, p_updated_at)
  ON CONFLICT (id) DO UPDATE
    SET
      amount      = EXCLUDED.amount,
      category    = EXCLUDED.category,
      date        = EXCLUDED.date,
      type        = EXCLUDED.type,
      description = EXCLUDED.description,
      subcategory = EXCLUDED.subcategory,
      updated_at  = EXCLUDED.updated_at
    WHERE transactions.updated_at IS NULL
       OR EXCLUDED.updated_at > transactions.updated_at;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION upsert_transaction_safe TO authenticated;
