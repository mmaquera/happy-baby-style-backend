import { GraphQLError } from 'graphql';
import { Permission, TokenPayload, UserRole } from './types';

export function requireRole(
  currentUser: TokenPayload | null | undefined,
  ...allowedRoles: UserRole[]
): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  if (!allowedRoles.includes(currentUser.role as UserRole)) {
    throw new GraphQLError('Insufficient privileges', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
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
 * Backward-compat: if the token has no `groups` field (pre-Fase 5 token), throws FORBIDDEN —
 * caller should combine with role-based fallback if needed.
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
  if (!currentUser.groups?.includes(groupCode)) {
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
  const userGroups = currentUser.groups ?? [];
  const hasAny = groupCodes.some(code => userGroups.includes(code));
  if (!hasAny) {
    throw new GraphQLError('Insufficient privileges', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
}

/** Alias kept for backward compatibility — functionally equivalent to requireRole(ADMIN). */
export function requireAdmin(currentUser: TokenPayload | null | undefined): void {
  requireRole(currentUser, UserRole.ADMIN);
}

export function assertOwnerOrAdmin(
  currentUser: TokenPayload | null | undefined,
  ownerId: string,
): void {
  if (!currentUser) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  if (currentUser.role !== UserRole.ADMIN && currentUser.userId !== ownerId) {
    throw new GraphQLError('Forbidden: not the owner', {
      extensions: { code: 'FORBIDDEN', http: { status: 403 } },
    });
  }
}
