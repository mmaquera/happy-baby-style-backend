-- Migration: 0003_add_payment_appevent_indexes_and_force_pwd_reset
-- Purely additive: ADD COLUMN nullable + CREATE INDEX.
-- No data loss. ADD COLUMN nullable is instant in PG 16.
-- Note: CONCURRENTLY removed — prisma migrate deploy wraps each migration in a
-- transaction, and CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- On pre-prod tables (small/empty) a regular CREATE INDEX IF NOT EXISTS is safe
-- and fully compatible with prisma migrate deploy. For high-traffic production
-- tables a manual CONCURRENTLY run outside migrate is the right approach.
--
-- Changes:
--   1. user_passwords: add must_change_password_at (nullable DateTime)
--      Semantics: non-null → login must redirect to change-password flow.
--      Cohesion: lives alongside reset_token / reset_expires_at in same table.
--   2. saved_payment_methods: index on user_id (FK, used in every list-by-user query).
--   3. app_events: four indexes for analytics/behavioural query patterns:
--        - user_id              → queries by user
--        - product_id           → queries by product (recommendation engine)
--        - (user_id, event_type)→ composite for "user's events of type X"
--        - created_at           → time-range scans (daily/weekly rollups)

-- AlterTable: add force-password-reset timestamp to user_passwords
ALTER TABLE "user_passwords" ADD COLUMN "must_change_password_at" TIMESTAMP(3);

-- CreateIndex: saved_payment_methods.user_id
CREATE INDEX IF NOT EXISTS "saved_payment_methods_user_id_idx" ON "saved_payment_methods"("user_id");

-- CreateIndex: app_events.user_id
CREATE INDEX IF NOT EXISTS "app_events_user_id_idx" ON "app_events"("user_id");

-- CreateIndex: app_events.product_id
CREATE INDEX IF NOT EXISTS "app_events_product_id_idx" ON "app_events"("product_id");

-- CreateIndex: app_events (user_id, event_type) composite
CREATE INDEX IF NOT EXISTS "app_events_user_id_event_type_idx" ON "app_events"("user_id", "event_type");

-- CreateIndex: app_events.created_at
CREATE INDEX IF NOT EXISTS "app_events_created_at_idx" ON "app_events"("created_at");
