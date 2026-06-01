-- Migration B — Backfill user_groups from user_profiles.role
--
-- PURPOSE:
--   Assigns every existing user to the group(s) that correspond to their
--   legacy `role` column, implementing the approved Fase 5.3 mapping:
--
--     admin    → administrators
--     customer → customer
--     staff    → sales-user  +  inventory-user  +  customer-service
--
-- CANONICAL MECHANISM:
--   The runtime-authoritative backfill is in libs/prisma/seed.ts (see
--   backfillUserGroups()). This SQL migration is documentation for that
--   operation and serves as the canonical mechanism when the project
--   switches from `prisma db push` to `prisma migrate deploy`.
--
-- IDEMPOTENCY:
--   ON CONFLICT (user_id, group_id) DO NOTHING — safe to run multiple times.
--
-- INVARIANT:
--   Does NOT modify user_profiles.role — that column is removed in Fase 5.11.

INSERT INTO user_groups (user_id, group_id, granted_at, granted_by)
SELECT
  up.id                   AS user_id,
  g.id                    AS group_id,
  NOW()                   AS granted_at,
  'system-backfill'       AS granted_by
FROM user_profiles up
JOIN groups g ON
  (up.role = 'admin'     AND g.code = 'administrators')   OR
  (up.role = 'customer'  AND g.code = 'customer')         OR
  (up.role = 'staff'     AND g.code IN ('sales-user', 'inventory-user', 'customer-service'))
ON CONFLICT (user_id, group_id) DO NOTHING;
