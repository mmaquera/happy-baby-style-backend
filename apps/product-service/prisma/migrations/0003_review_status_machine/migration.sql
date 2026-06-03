-- Migration: 0003_review_status_machine
-- Purpose: Add ReviewStatus state machine to product_reviews.
--
-- Strategy: 3-step additive migration (backward-compatible, no downtime):
--   Step 1 — CREATE TYPE + ADD COLUMN nullable (no table lock beyond metadata).
--   Step 2 — BACKFILL: derive status from existing is_approved boolean.
--   Step 3 — SET NOT NULL + ADD INDEX (composite on product_id, status).
--
-- is_approved column is intentionally RETAINED for backward compatibility.
-- It is marked @deprecated in the Prisma schema. Remove in a future migration
-- once all consumers have been migrated to read `status`.
--
-- Index strategy:
--   The existing unique index on (product_id, user_id) already covers
--   WHERE product_id = ? lookups. The new composite @@index([productId, status])
--   covers the moderation query pattern: WHERE product_id = ? AND status = 'approved'.
--   NOT using CONCURRENTLY because this runs inside a Prisma migrate transaction.

-- Step 1: Create enum type
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- Step 1: Add column nullable first (safe on live table — no NOT NULL constraint yet)
ALTER TABLE "product_reviews" ADD COLUMN "status" "ReviewStatus";

-- Step 2: Backfill — derive status from the legacy is_approved boolean.
--   is_approved = true  → approved
--   is_approved = false → pending  (not rejected — absence of approval ≠ explicit rejection)
UPDATE "product_reviews"
  SET "status" = CASE
    WHEN "is_approved" = true  THEN 'approved'::"ReviewStatus"
    ELSE                             'pending'::"ReviewStatus"
  END;

-- Step 3: Now that all rows have a value, enforce NOT NULL + DEFAULT for future inserts
ALTER TABLE "product_reviews"
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'pending';

-- Step 3: Add composite index (product_id, status) for moderation + public listing queries.
-- Covers: WHERE product_id = ? AND status = 'approved'
-- Also covers: WHERE product_id = ? (leading column prefix scan)
CREATE INDEX "product_reviews_product_id_status_idx" ON "product_reviews"("product_id", "status");
