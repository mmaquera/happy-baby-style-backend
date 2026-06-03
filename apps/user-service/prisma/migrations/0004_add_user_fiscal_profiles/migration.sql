-- Migration: 0004_add_user_fiscal_profiles
-- Purpose: Fiscal data table for SUNAT electronic invoicing (FE-0, Phase A)
-- Adds: enum tax_document_type, table user_fiscal_profiles, indexes, partial unique on RUC

-- 1. Enum
CREATE TYPE "tax_document_type" AS ENUM ('ruc', 'dni', 'ce');

-- 2. Table
CREATE TABLE "user_fiscal_profiles" (
    "id"              TEXT         NOT NULL,
    "user_id"         TEXT         NOT NULL,
    "document_type"   "tax_document_type" NOT NULL,
    "document_number" VARCHAR(20)  NOT NULL,
    "legal_name"      TEXT,
    "verified_at"     TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_fiscal_profiles_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "user_fiscal_profiles_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Unique constraint for 1:1 relationship (userId)
CREATE UNIQUE INDEX "user_fiscal_profiles_user_id_key"
    ON "user_fiscal_profiles"("user_id");

-- 4. Composite index: lookup by document type + number (invoicing-service queries)
CREATE INDEX "user_fiscal_profiles_document_type_document_number_idx"
    ON "user_fiscal_profiles"("document_type", "document_number");

-- 5. Partial unique: a single RUC can only belong to one user.
--    DNI and CE are allowed to repeat (shared family members, etc.).
--    Prisma does not support partial unique natively — implemented as raw SQL.
CREATE UNIQUE INDEX "user_fiscal_profiles_ruc_unique"
    ON "user_fiscal_profiles"("document_number")
    WHERE document_type = 'ruc';
