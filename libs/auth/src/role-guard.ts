import { GraphQLError } from 'graphql';
import { Permission, TokenPayload } from './types';

/**
 * Local helper — does NOT import from @hbs/authz to avoid a circular dependency.
 * @hbs/authz depends on @hbs/auth; the reverse direction is forbidden.
 */
function isInGroup(user: TokenPayload, groupCode: string): boolean {
  return Array.isArray(user.groups) && user.groups.includes(groupCode);
}

export function requirePermission(
  currentUser: TokenPayload | null | undefined,
  permission: Permission,
): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  if (!currentUser.permissions?.includes(permission)) {
    throw new GraphQLError('Insufficient privileges', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
}

/**
 * Throws FORBIDDEN if the user doesn't belong to the specified group.
 * Throws UNAUTHENTICATED if currentUser is null/undefined.
 */
export function requireGroup(
  currentUser: TokenPayload | null | undefined,
  groupCode: string,
): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  if (!isInGroup(currentUser, groupCode)) {
    throw new GraphQLError('Insufficient privileges', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
}

/**
 * Throws FORBIDDEN if the user doesn't belong to ANY of the listed groups.
 * Throws UNAUTHENTICATED if currentUser is null/undefined.
 */
export function requireAnyGroup(
  currentUser: TokenPayload | null | undefined,
  ...groupCodes: string[]
): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  const hasAny = groupCodes.some(code => isInGroup(currentUser, code));
  if (!hasAny) {
    throw new GraphQLError('Insufficient privileges', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
}

/**
 * Requires the user to belong to the `administrators` group.
 * Throws UNAUTHENTICATED if not logged in; FORBIDDEN if not in the group.
 */
export function requireAdmin(currentUser: TokenPayload | null | undefined): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  if (!isInGroup(currentUser, 'administrators')) {
    throw new GraphQLError('Insufficient privileges', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
}

/**
 * Requires the caller to be the resource owner OR belong to `administrators`.
 * - Owner check: ctx.userId === ownerId (never trust ownerId from GraphQL input — callers
 *   must pass the persisted owner id from the database).
 * - Admin bypass: membership in the `administrators` group.
 * Throws UNAUTHENTICATED if not logged in; FORBIDDEN if neither condition holds.
 */
export function assertOwnerOrAdmin(
  currentUser: TokenPayload | null | undefined,
  ownerId: string,
): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  const isOwner = currentUser.userId === ownerId;
  const isAdmin = isInGroup(currentUser, 'administrators');
  if (!isOwner && !isAdmin) {
    throw new GraphQLError('Forbidden: not the owner', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
}
