import { PrismaClient } from '../../prisma';
import { LoggerFactory } from '@hbs/logging';
import { EffectiveAuthz } from '@domain/interfaces/IEffectiveAuthz';
import { IEffectivePermissionsResolver } from '@domain/interfaces/IEffectivePermissionsResolver';

export { EffectiveAuthz };

/**
 * Resolves the effective RBAC groups and permissions for a user via a single
 * recursive CTE query.  Avoids N+1 by computing the full transitively-expanded
 * group set in PostgreSQL and joining permissions in the same round-trip.
 *
 * Lives in infrastructure/ because it uses Prisma.$queryRaw — Prisma does not
 * support CTEs declaratively, so raw SQL is required here.
 *
 * Cycle prevention: the CTE terminates when no new rows are added (PostgreSQL
 * UNION deduplication).  However, cycles in group_implications (A→B→A) are NOT
 * detected by this query — the application layer MUST prevent them at insert time.
 *
 * If the user has no assigned groups (pre-backfill), returns empty arrays so the
 * caller can apply the legacy role-based fallback.
 */
export class EffectivePermissionsResolver implements IEffectivePermissionsResolver {
  private readonly logger = LoggerFactory.getInstance().createRepositoryLogger(
    'EffectivePermissionsResolver',
  );

  constructor(private readonly prisma: PrismaClient) {}

  async resolveForUser(userId: string): Promise<EffectiveAuthz> {
    this.logger.info('Resolving effective RBAC authz for user', { userId });

    // The CTE:
    //   1. Seed: fetch direct group assignments from user_groups.
    //   2. Recurse: expand via group_implications (parent implies child).
    //   3. Collect: aggregate distinct group codes and permission codes.
    //
    // UNION (not UNION ALL) guarantees deduplication — handles DAG-style graphs
    // and terminates correctly.  Cycles still loop indefinitely, hence the
    // application-level constraint.
    // Validate UUID format before using in raw query to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return { groupCodes: [], permissionCodes: [] };
    }

    const result = await this.prisma.$queryRawUnsafe<
      Array<{
        group_codes: string[];
        permission_codes: string[];
      }>
    >(`
      WITH RECURSIVE effective_groups AS (
        -- Base: groups directly assigned to the user
        SELECT g.id, g.code
        FROM user_groups ug
        JOIN groups g ON g.id = ug.group_id
        WHERE ug.user_id = '${userId}'

        UNION

        -- Recursive: groups implied transitively via group_implications
        SELECT g.id, g.code
        FROM effective_groups eg
        JOIN group_implications gi ON gi.group_id = eg.id
        JOIN groups g ON g.id = gi.implied_group_id
      )
      SELECT
        ARRAY(
          SELECT DISTINCT eg2.code
          FROM effective_groups eg2
          ORDER BY eg2.code
        ) AS group_codes,
        ARRAY(
          SELECT DISTINCT p.code
          FROM effective_groups eg3
          JOIN group_permissions gp ON gp.group_id = eg3.id
          JOIN permissions p ON p.id = gp.permission_id
          ORDER BY p.code
        ) AS permission_codes
    `);

    const row = result[0];
    const groupCodes: string[] = row?.group_codes ?? [];
    const permissionCodes: string[] = row?.permission_codes ?? [];

    this.logger.info('Resolved effective RBAC authz', {
      userId,
      groupCount: groupCodes.length,
      permissionCount: permissionCodes.length,
    });

    return { groupCodes, permissionCodes };
  }
}
