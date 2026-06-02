/**
 * Order-service authorization guards — application layer.
 *
 * These helpers are used INSIDE use cases (application layer), NOT in resolvers.
 * They use GraphQLError only to produce standard UNAUTHENTICATED / FORBIDDEN
 * responses that the resolver's mapDomainError will translate to HTTP semantics.
 *
 * Design (Fase A2 — groups-only):
 *   - assertOwnerOrOrderManagement: owner can see their own data; management
 *     (group-based) can see any user's data.
 *   - Authorization is exclusively group-based. The legacy role field is no
 *     longer present on TokenPayload.
 */

import { GraphQLError } from 'graphql';
import type { TokenPayload } from '@hbs/auth';

const ORDER_MANAGEMENT_GROUPS = [
  'administrators',
  'sales-manager',
  'sales-user',
  'customer-service',
] as const;

/**
 * Returns true when the current user has order-management access (group-based).
 */
export function hasOrderManagementAccess(currentUser: TokenPayload): boolean {
  return (
    currentUser.groups?.some((g) => (ORDER_MANAGEMENT_GROUPS as readonly string[]).includes(g)) ??
    false
  );
}

/**
 * Asserts that the current user is either the owner of the resource
 * OR has order-management access (management group membership).
 *
 * Throws:
 *   - UNAUTHENTICATED (401)  — when currentUser is null/undefined.
 *   - FORBIDDEN (403)        — when the user is authenticated but is not the owner
 *                              and does not have management access.
 *
 * Note: for by-id queries that also need to prevent existence enumeration, the
 * use case should throw NotFoundError (ambiguous 404) instead of letting this
 * throw FORBIDDEN when the caller is not management. See GetPaymentMethodByIdUseCase.
 */
export function assertOwnerOrOrderManagement(
  currentUser: TokenPayload | null | undefined,
  targetUserId: string,
): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  if (currentUser.userId === targetUserId) {
    return; // owner
  }
  if (hasOrderManagementAccess(currentUser)) {
    return; // management
  }
  throw new GraphQLError('Insufficient privileges', {
    extensions: { code: 'FORBIDDEN', http: { status: 403 } },
  });
}

/**
 * Asserts that the current user has order-management access (not just ownership).
 * Used for admin-scoped resources like coupons and store settings.
 *
 * Throws:
 *   - UNAUTHENTICATED (401) — when currentUser is null/undefined.
 *   - FORBIDDEN (403)       — when authenticated but without management access.
 */
export function assertOrderManagementAccess(
  currentUser: TokenPayload | null | undefined,
): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  if (hasOrderManagementAccess(currentUser)) {
    return;
  }
  throw new GraphQLError('Insufficient privileges', {
    extensions: { code: 'FORBIDDEN', http: { status: 403 } },
  });
}
