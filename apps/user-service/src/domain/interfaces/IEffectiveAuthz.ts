/**
 * The resolved RBAC authorization context for a user.
 *
 * Computed by traversing user_groups → group_implications (transitively) →
 * group_permissions → permissions via a single recursive CTE query.
 *
 * When groupCodes is empty the caller MUST apply the legacy role-based
 * permission fallback (ROLE_PERMISSIONS map from @hbs/auth).
 */
export interface EffectiveAuthz {
  /** Resolved group codes including transitively inherited groups. */
  groupCodes: string[];
  /** Resolved permission codes from all effective groups. */
  permissionCodes: string[];
}
