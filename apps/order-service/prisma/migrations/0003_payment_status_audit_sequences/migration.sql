-- Migration: 0003_payment_status_audit_sequences
-- Additive only: CREATE TYPE, ADD COLUMN (with DEFAULT), CREATE TABLE, CREATE INDEX.
-- No DROP, no RENAME, no NOT NULL on existing columns.
-- Safe for rolling deploys (prisma migrate deploy).

-- ─── 1. New enum: PaymentStatus ─────────────────────────────────────────────
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'refunded', 'failed');

-- ─── 2. Add payment_status column to orders ──────────────────────────────────
-- Nullable-or-default pattern: column gets a DEFAULT so existing rows are
-- backfilled by Postgres atomically at ALTER time — no separate backfill needed.
ALTER TABLE "orders"
  ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending';

-- ─── 3. Create order_status_history (audit table) ───────────────────────────
CREATE TABLE "order_status_history" (
    "id"                TEXT        NOT NULL,
    "order_id"          TEXT        NOT NULL,
    "from_status"       TEXT        NOT NULL,
    "to_status"         TEXT        NOT NULL,
    -- Nullable: system / consumer transitions (payment webhooks, stock decrements)
    -- originate without an authenticated user context.
    "changed_by_user_id" TEXT,
    "changed_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"             TEXT,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- FK to orders (Cascade delete: history is meaningless without its order)
ALTER TABLE "order_status_history"
  ADD CONSTRAINT "order_status_history_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Composite index: primary access pattern is "all history for order X ordered by time"
-- Also covers point lookups on order_id alone (leftmost prefix).
-- NOTE: CREATE INDEX CONCURRENTLY is NOT used here — it cannot run inside a
-- transaction, and prisma migrate deploy wraps each migration in a transaction.
CREATE INDEX "order_status_history_order_id_changed_at_idx"
  ON "order_status_history"("order_id", "changed_at");

-- ─── 4. Create order_sequences (folio generator) ────────────────────────────
CREATE TABLE "order_sequences" (
    "id"         TEXT        NOT NULL,
    "year"       INTEGER     NOT NULL,
    -- BigInt: future-proofs beyond INT4 range (~2.1B) at the cost of requiring
    -- BigInt handling at the application boundary. Use String conversion for
    -- zero-padded folio formatting (ORD-YYYY-NNNNNN).
    "last_value" BIGINT      NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_sequences_pkey" PRIMARY KEY ("id")
);

-- UNIQUE on year is mandatory: the ON CONFLICT (year) DO UPDATE upsert pattern
-- requires a unique constraint to target. Without it the INSERT ... ON CONFLICT
-- syntax is invalid.
CREATE UNIQUE INDEX "order_sequences_year_key" ON "order_sequences"("year");
