-- Migration: 0005_variant_tax_affectation
-- Adds optional tax_affectation column to product_variants table.
-- NULL means "inherit from parent product" (effective affectation resolved at app layer).
-- Backward-compatible: existing rows stay NULL, no data loss, no default enforced.
-- TaxAffectation enum already exists from migration 0004 — no CREATE TYPE needed.

ALTER TABLE "product_variants"
  ADD COLUMN "tax_affectation" "TaxAffectation";
