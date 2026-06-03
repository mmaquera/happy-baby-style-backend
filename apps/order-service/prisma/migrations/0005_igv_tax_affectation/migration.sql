-- Migration: 0005_igv_tax_affectation
-- Description: IGV / SUNAT tax affectation — Ronda 1 Tarea 1b.
--
-- Adds:
--   1. Postgres enum type `TaxAffectation` with values gravado | exonerado | inafecto.
--   2. Four accumulator columns on `orders` (taxable_amount, exempt_amount,
--      non_taxable_amount, igv_amount) — all Decimal(12,2) NOT NULL DEFAULT 0.
--   3. Three immutable snapshot columns on `order_items` (tax_affectation,
--      igv_base, igv_amount) — DEFAULT keeps historical rows valid.
--
-- Safety guarantees:
--   - 100% additive: CREATE TYPE + ADD COLUMN with DEFAULT, zero data rewrites.
--   - Compatible with `prisma migrate deploy` in a rolling deploy.
--   - No CREATE INDEX CONCURRENTLY (unsupported inside migration transactions).
--   - No DROP or RENAME — purely additive.
--   - Historical orders get 0/gravado defaults, which are accurate representations
--     of pre-IGV-aware data (not NULL ambiguity).

-- Step 1: Create the enum type
-- Using DO $$ to make it idempotent if the type already exists (safe re-run).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaxAffectation') THEN
    CREATE TYPE "TaxAffectation" AS ENUM ('gravado', 'exonerado', 'inafecto');
  END IF;
END
$$;

-- Step 2: Add IGV accumulator columns to orders
-- All four columns are NOT NULL with DEFAULT 0 → backwards-compatible ADD COLUMN.
-- Decimal(12,2): handles PEN amounts up to 9,999,999,999.99 (covers multi-item orders).
ALTER TABLE "orders"
  ADD COLUMN "taxable_amount"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "exempt_amount"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "non_taxable_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "igv_amount"        DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Step 3: Add immutable IGV snapshot columns to order_items
-- tax_affectation defaults to 'gravado' (most common case for PE e-commerce).
-- igv_base / igv_amount default to 0 — correct for historical items without breakdown.
ALTER TABLE "order_items"
  ADD COLUMN "tax_affectation" "TaxAffectation" NOT NULL DEFAULT 'gravado',
  ADD COLUMN "igv_base"        DECIMAL(12,2)    NOT NULL DEFAULT 0,
  ADD COLUMN "igv_amount"      DECIMAL(12,2)    NOT NULL DEFAULT 0;
