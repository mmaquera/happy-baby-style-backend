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
import { UserRole } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';
import { assertModelAccess } from '../assert-model-access';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides?: Partial<TokenPayload>): TokenPayload {
  return {
    userId: 'u-test',
    email: 'test@example.com',
    role: UserRole.CUSTOMER,
    permissions: [],
    groups: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('assertModelAccess', () => {
  // ── UNAUTHENTICATED ────────────────────────────────────────────────────────

  it('throws UNAUTHENTICATED when currentUser is null', () => {
    expect(() => assertModelAccess(null, 'Order', 'read')).toThrow(GraphQLError);
    try {
      assertModelAccess(null, 'Order', 'read');
    } catch (e) {
      expect((e as GraphQLError).extensions.code).toBe('UNAUTHENTICATED');
      expect((e as GraphQLError).extensions.http).toMatchObject({ status: 401 });
    }
  });

  it('throws UNAUTHENTICATED when currentUser is undefined', () => {
    expect(() => assertModelAccess(undefined, 'Order', 'read')).toThrow(GraphQLError);
    try {
      assertModelAccess(undefined, 'Order', 'read');
    } catch (e) {
      expect((e as GraphQLError).extensions.code).toBe('UNAUTHENTICATED');
    }
  });

  // ── Admin bypass — legacy role ────────────────────────────────────────────

  it('bypasses check for admin legacy role', () => {
    const admin = makeUser({ role: UserRole.ADMIN, permissions: [] });
    // Should not throw even with no permissions
    expect(() => assertModelAccess(admin, 'Order', 'unlink')).not.toThrow();
  });

  it('bypasses check for admin legacy role even on unknown model', () => {
    const admin = makeUser({ role: UserRole.ADMIN, permissions: [] });
    expect(() => assertModelAccess(admin, 'UnknownModel', 'create')).not.toThrow();
  });

  // ── Admin bypass — administrators group ────────────────────────────────────

  it('bypasses check for user in administrators group', () => {
    const admin = makeUser({
      role: UserRole.STAFF,
      groups: ['administrators'],
      permissions: [],
    });
    expect(() => assertModelAccess(admin, 'StoreSettings', 'write')).not.toThrow();
  });

  it('administrators group bypasses even on unknown model', () => {
    const admin = makeUser({
      role: UserRole.STAFF,
      groups: ['administrators'],
      permissions: [],
    });
    expect(() => assertModelAccess(admin, 'GhostModel', 'create')).not.toThrow();
  });

  // ── User with correct permission ───────────────────────────────────────────

  it('passes when user has the required permission for Order.read', () => {
    const user = makeUser({ permissions: ['read:order'] });
    expect(() => assertModelAccess(user, 'Order', 'read')).not.toThrow();
  });

  it('passes when user has required permission for Product.write', () => {
    const user = makeUser({ permissions: ['update:product'] });
    expect(() => assertModelAccess(user, 'Product', 'write')).not.toThrow();
  });

  it('passes when user has required permission for InventoryTransaction.create', () => {
    const user = makeUser({ permissions: ['update:product'] });
    expect(() => assertModelAccess(user, 'InventoryTransaction', 'create')).not.toThrow();
  });

  it('passes when user has required permission for ProductReview.create', () => {
    const user = makeUser({ permissions: ['create:order'] });
    expect(() => assertModelAccess(user, 'ProductReview', 'create')).not.toThrow();
  });

  // ── User missing permission → FORBIDDEN ───────────────────────────────────

  it('throws FORBIDDEN when user lacks the required permission for Order.create', () => {
    const user = makeUser({ permissions: ['read:order'] }); // only read, not create
    expect(() => assertModelAccess(user, 'Order', 'create')).toThrow(GraphQLError);
    try {
      assertModelAccess(user, 'Order', 'create');
    } catch (e) {
      expect((e as GraphQLError).extensions.code).toBe('FORBIDDEN');
      expect((e as GraphQLError).extensions.http).toMatchObject({ status: 403 });
    }
  });

  it('throws FORBIDDEN when user has no permissions at all', () => {
    const user = makeUser({ permissions: [] });
    expect(() => assertModelAccess(user, 'Product', 'write')).toThrow(GraphQLError);
    try {
      assertModelAccess(user, 'Product', 'write');
    } catch (e) {
      expect((e as GraphQLError).extensions.code).toBe('FORBIDDEN');
    }
  });

  it('FORBIDDEN error message mentions the required permission code', () => {
    const user = makeUser({ permissions: [] });
    try {
      assertModelAccess(user, 'Order', 'unlink');
    } catch (e) {
      expect((e as GraphQLError).message).toContain('delete:order');
    }
  });

  // ── Unknown model → FORBIDDEN (fail-closed) ────────────────────────────────

  it('throws FORBIDDEN for unknown model (fail-closed)', () => {
    const user = makeUser({ permissions: ['manage:system', 'read:order', 'create:order'] });
    expect(() => assertModelAccess(user, 'NonExistentModel', 'read')).toThrow(GraphQLError);
    try {
      assertModelAccess(user, 'NonExistentModel', 'read');
    } catch (e) {
      expect((e as GraphQLError).extensions.code).toBe('FORBIDDEN');
      expect((e as GraphQLError).extensions.http).toMatchObject({ status: 403 });
    }
  });

  it('unknown model FORBIDDEN message mentions the model name', () => {
    const user = makeUser({ permissions: ['manage:system'] });
    try {
      assertModelAccess(user, 'GhostEntity', 'create');
    } catch (e) {
      expect((e as GraphQLError).message).toContain('GhostEntity');
    }
  });

  // ── manage:system models ───────────────────────────────────────────────────

  it('passes StoreSettings.read when user has manage:system', () => {
    const user = makeUser({ permissions: ['manage:system'] });
    expect(() => assertModelAccess(user, 'StoreSettings', 'read')).not.toThrow();
  });

  it('throws FORBIDDEN for StoreSettings.read without manage:system', () => {
    const user = makeUser({ permissions: ['read:order', 'create:order'] });
    expect(() => assertModelAccess(user, 'StoreSettings', 'read')).toThrow(GraphQLError);
    try {
      assertModelAccess(user, 'StoreSettings', 'read');
    } catch (e) {
      expect((e as GraphQLError).extensions.code).toBe('FORBIDDEN');
    }
  });
});
