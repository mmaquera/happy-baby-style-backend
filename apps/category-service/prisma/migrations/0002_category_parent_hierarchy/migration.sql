-- Migration: 0002_category_parent_hierarchy
-- Purpose: Add adjacency-list parent/child self-relation to categories.
--
-- Strategy: ADDITIVE only.
--   1. ADD COLUMN parent_id nullable (no data loss, no table rewrite on existing rows).
--   2. ADD FK CONSTRAINT with ON DELETE SET NULL (orphans children, never cascade-deletes subtrees).
--   3. CREATE INDEX on parent_id (covers findChildren / findByParentId queries).
--
-- Backward compatibility:
--   - Column is nullable → all existing rows get parent_id = NULL (they become roots).
--   - No UPDATE / DELETE on existing data.
--   - The FK is DEFERRABLE INITIALLY IMMEDIATE (Postgres default) — safe for rolling deploy.
--   - NOT using CONCURRENTLY because this runs inside a Prisma migrate transaction.
--     CONCURRENTLY is not allowed inside a transaction block.

-- AddColumn
ALTER TABLE "categories" ADD COLUMN "parent_id" TEXT;

-- AddForeignKey
ALTER TABLE "categories"
  ADD CONSTRAINT "categories_parent_id_fkey"
  FOREIGN KEY ("parent_id")
  REFERENCES "categories"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");
