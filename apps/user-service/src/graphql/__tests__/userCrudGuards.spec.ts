/**
 * User CRUD guard tests — Fase 4 ACL migration
 *
 * Verifies that User CRUD mutations (createUser, updateUser, updateUserRole,
 * deleteUser, activateUser, deactivateUser) honour the new assertModelAccess
 * gate rather than bare requireRole(ADMIN).
 *
 * Strategy: call assertModelAccess directly (the exact function used in
 * resolvers) with a TokenPayload that has groups=['administrators'] but
 * role!='admin' (new-style) and confirm it passes; confirm customer FORBIDDEN.
 */

jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    }),
  },
}), { virtual: true });

import { GraphQLError } from 'graphql';
import type { TokenPayload } from '@hbs/auth';
import { assertModelAccess } from '@hbs/authz';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeAdminGroupUser(overrides?: Partial<TokenPayload>): TokenPayload {
  return {
    userId: 'admin-group-u1',
    email: 'groupadmin@example.com',
    groups: ['administrators'],
    permissions: [],
    ...overrides,
  };
}

function makeCustomer(overrides?: Partial<TokenPayload>): TokenPayload {
  return {
    userId: 'customer-u1',
    email: 'customer@example.com',
    groups: [],
    permissions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createUser guard
// ---------------------------------------------------------------------------

describe('createUser guard — assertModelAccess(User, create)', () => {
  it('passes for administrator group user (role!=admin)', () => {
    const ctx = makeAdminGroupUser();
    expect(() => assertModelAccess(ctx, 'User', 'create')).not.toThrow();
  });

  it('throws FORBIDDEN for customer with no permissions', () => {
    const ctx = makeCustomer();
    expect(() => assertModelAccess(ctx, 'User', 'create')).toThrow(GraphQLError);
    try {
      assertModelAccess(ctx, 'User', 'create');
    } catch (e) {
      expect((e as GraphQLError).extensions.code).toBe('FORBIDDEN');
    }
  });

  it('passes for user with create:user permission', () => {
    const ctx = makeCustomer({ permissions: ['create:user'] });
    expect(() => assertModelAccess(ctx, 'User', 'create')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// updateUser / updateUserRole / activateUser / deactivateUser guard
// ---------------------------------------------------------------------------

describe('updateUser guard — assertModelAccess(User, write)', () => {
  it('passes for administrator group user (role!=admin)', () => {
    const ctx = makeAdminGroupUser();
    expect(() => assertModelAccess(ctx, 'User', 'write')).not.toThrow();
  });

  it('throws FORBIDDEN for customer with no permissions', () => {
    const ctx = makeCustomer();
    expect(() => assertModelAccess(ctx, 'User', 'write')).toThrow(GraphQLError);
    try {
      assertModelAccess(ctx, 'User', 'write');
    } catch (e) {
      expect((e as GraphQLError).extensions.code).toBe('FORBIDDEN');
      expect((e as GraphQLError).extensions.http).toMatchObject({ status: 403 });
    }
  });

  it('throws UNAUTHENTICATED when context has no user', () => {
    expect(() => assertModelAccess(null, 'User', 'write')).toThrow(GraphQLError);
    try {
      assertModelAccess(null, 'User', 'write');
    } catch (e) {
      expect((e as GraphQLError).extensions.code).toBe('UNAUTHENTICATED');
    }
  });

  it('error message for FORBIDDEN mentions update:user permission code', () => {
    const ctx = makeCustomer({ permissions: ['read:user'] });
    try {
      assertModelAccess(ctx, 'User', 'write');
    } catch (e) {
      expect((e as GraphQLError).message).toContain('update:user');
    }
  });
});

// ---------------------------------------------------------------------------
// deleteUser guard
// ---------------------------------------------------------------------------

describe('deleteUser guard — assertModelAccess(User, unlink)', () => {
  it('passes for administrator group user (role!=admin)', () => {
    const ctx = makeAdminGroupUser();
    expect(() => assertModelAccess(ctx, 'User', 'unlink')).not.toThrow();
  });

  it('throws FORBIDDEN for customer role without delete:user', () => {
    const ctx = makeCustomer({ permissions: ['create:user', 'update:user'] });
    expect(() => assertModelAccess(ctx, 'User', 'unlink')).toThrow(GraphQLError);
    try {
      assertModelAccess(ctx, 'User', 'unlink');
    } catch (e) {
      expect((e as GraphQLError).extensions.code).toBe('FORBIDDEN');
    }
  });

  it('passes for user with delete:user permission', () => {
    const ctx = makeCustomer({ permissions: ['delete:user'] });
    expect(() => assertModelAccess(ctx, 'User', 'unlink')).not.toThrow();
  });
});
