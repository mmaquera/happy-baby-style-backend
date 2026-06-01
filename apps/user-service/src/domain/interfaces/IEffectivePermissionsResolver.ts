import { EffectiveAuthz } from './IEffectiveAuthz';

/**
 * Port: resolves the effective RBAC authorization context for a user.
 *
 * Implementations may use a DB CTE, a cache, or any other mechanism.
 * Application layer depends only on this interface — never on the concrete
 * infrastructure implementation.
 */
export interface IEffectivePermissionsResolver {
  resolveForUser(userId: string): Promise<EffectiveAuthz>;
}
