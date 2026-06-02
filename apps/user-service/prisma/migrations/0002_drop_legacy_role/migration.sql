-- Migration: 0002_drop_legacy_role
-- Removes the legacy role column from user_profiles and drops the UserRole enum.
--
-- Pre-condition (MUST hold before applying):
--   Every row in user_profiles has at least one row in user_groups.
--   Verify with:
--     SELECT up.id, up.email FROM user_profiles up
--     LEFT JOIN user_groups ug ON ug.user_id = up.id
--     WHERE ug.user_id IS NULL;
--   Result must be empty. If not: run the seed backfill or assign groups manually.
--
-- The column was used only for backward-compat during Phase A rollout.
-- Authorization is now 100% via groups + permissions (user_groups + group_permissions).
--
-- Enum name confirmed from 0001_baseline/migration.sql:
--   CREATE TYPE "UserRole" AS ENUM ('admin', 'customer', 'staff');

-- AlterTable: drop the role column (has a DEFAULT constraint, PG removes it atomically)
ALTER TABLE "user_profiles" DROP COLUMN "role";

-- DropEnum: safe only after the column that referenced it is gone
DROP TYPE "UserRole";
