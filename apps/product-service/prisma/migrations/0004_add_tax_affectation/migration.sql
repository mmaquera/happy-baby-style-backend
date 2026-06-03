-- Migration: 0004_add_tax_affectation
-- Adds TaxAffectation enum and tax_affectation column to products table.
-- Backward-compatible: existing rows receive default 'gravado' (IGV 18% — most products).

CREATE TYPE "TaxAffectation" AS ENUM ('gravado', 'exonerado', 'inafecto');

ALTER TABLE "products"
  ADD COLUMN "tax_affectation" "TaxAffectation" NOT NULL DEFAULT 'gravado';
