import { GraphQLError } from 'graphql';
import type { TokenPayload } from '@hbs/auth';
import { isAdmin, hasPermission } from './helpers';
import { MODEL_ACCESS_MAP, type ModelOperation } from './model-access-map';

/**
 * ACL gate: enforces ir.model.access rules for a given model + operation.
 *
 * Semantics (in order):
 * 1. No current user       → UNAUTHENTICATED (HTTP 401).
 * 2. Admin (role or group) → bypass — full access.
 * 3. Unknown model         → FORBIDDEN — fail-closed; unknown models have no
 *                            defined access policy, so access is denied.
 * 4. Permission check      → FORBIDDEN if the user's permission codes do not
 *                            include the required code for this model+operation.
 *
 * Use this helper in resolvers before delegating to a use case, replacing
 * ad-hoc requirePermission calls for standard CRUD operations.
 *
 * @param currentUser  Authenticated user from request context, or null/undefined.
 * @param modelName    PascalCase entity name (must be a key in MODEL_ACCESS_MAP).
 * @param operation    One of: create | read | write | unlink.
 *
 * @throws GraphQLError(UNAUTHENTICATED) when currentUser is absent.
 * @throws GraphQLError(FORBIDDEN)       when access is denied.
 */
export function assertModelAccess(
  currentUser: TokenPayload | null | undefined,
  modelName: string,
  operation: ModelOperation,
): void {
  // 1 — authentication check
  if (!currentUser) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }

  // 2 — admin bypass (legacy role='admin' OR group 'administrators')
  if (isAdmin(currentUser)) {
    return;
  }

  // 3 — unknown model: fail-closed
  const modelMap = MODEL_ACCESS_MAP[modelName];
  if (!modelMap) {
    throw new GraphQLError(
      `Access denied: unknown model '${modelName}'`,
      { extensions: { code: 'FORBIDDEN', http: { status: 403 } } },
    );
  }

  // 4 — permission check
  const required = modelMap[operation];
  if (!hasPermission(currentUser, required)) {
    throw new GraphQLError(
      `Insufficient privileges: '${required}' required for ${modelName}.${operation}`,
      { extensions: { code: 'FORBIDDEN', http: { status: 403 } } },
    );
  }
}
