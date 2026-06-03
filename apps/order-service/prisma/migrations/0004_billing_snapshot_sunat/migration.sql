-- Migration: 0004_billing_snapshot_sunat
-- Description: Add SUNAT fiscal billing snapshot fields to orders table (FE-0 Phase A).
--   All columns are nullable — fully backward-compatible ADD COLUMN.
--   No FK constraints: billingAddressId is a weak reference across service boundary.
--   No new indexes: invoicing-service reads these fields by order_id (already indexed).

ALTER TABLE "orders"
  ADD COLUMN "billing_document_type"   VARCHAR(10),
  ADD COLUMN "billing_document_number" VARCHAR(20),
  ADD COLUMN "billing_legal_name"      VARCHAR(200),
  ADD COLUMN "billing_first_name"      VARCHAR(100),
  ADD COLUMN "billing_last_name"       VARCHAR(100),
  ADD COLUMN "billing_address_id"      UUID;
