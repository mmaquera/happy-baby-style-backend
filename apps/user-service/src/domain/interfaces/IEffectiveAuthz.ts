/**
 * The resolved RBAC authorization context for a user.
 *
 * Computed by traversing user_groups → group_implications (transitively) →
 * group_permissions → permissions via a single recursive CTE query.
 *
 * groupCodes is empty only for users not yet assigned to any group (edge case
 * after migration). No legacy role-based fallback — groups are the sole source
 * of authorization from Fase A2 onward.
 */
export interface EffectiveAuthz {
  /** Resolved group codes including transitively inherited groups. */
  groupCodes: string[];
  /** Resolved permission codes from all effective groups. */
  permissionCodes: string[];
}
