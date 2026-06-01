import { hasPermission, hasAnyPermission, belongsToGroup, belongsToAnyGroup, isAdmin } from '../helpers';
import { UserRole, Permission } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';

// helpers.ts does not use @hbs/logging — no mock needed.

// ---------------------------------------------------------------------------
// Test factory
// ---------------------------------------------------------------------------

function makeUser(overrides?: Partial<TokenPayload & { groups?: string[] }>): TokenPayload & { groups?: string[] } {
  return {
    userId: 'user-1',
    email: 'test@example.com',
    role: UserRole.CUSTOMER,
    permissions: [Permission.READ_PRODUCT, Permission.CREATE_ORDER],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// hasPermission
// ---------------------------------------------------------------------------

describe('hasPermission', () => {
  it('returns true when the user has the specified permission', () => {
    const user = makeUser({ permissions: [Permission.READ_PRODUCT, Permission.CREATE_ORDER] });
    expect(hasPermission(user, Permission.READ_PRODUCT)).toBe(true);
  });

  it('returns false when the user does not have the specified permission', () => {
    const user = makeUser({ permissions: [Permission.READ_PRODUCT] });
    expect(hasPermission(user, Permission.DELETE_PRODUCT)).toBe(false);
  });

  it('returns false when user is null', () => {
    expect(hasPermission(null, Permission.READ_PRODUCT)).toBe(false);
  });

  it('returns false when user is undefined', () => {
    expect(hasPermission(undefined, Permission.READ_PRODUCT)).toBe(false);
  });

  it('returns false when user has no permissions array (old token shape)', () => {
    const user = { userId: 'u1', email: 'a@b.com', role: UserRole.CUSTOMER } as any;
    expect(hasPermission(user, Permission.READ_PRODUCT)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasAnyPermission
// ---------------------------------------------------------------------------

describe('hasAnyPermission', () => {
  it('returns true when the user has at least one of the specified permissions', () => {
    const user = makeUser({ permissions: [Permission.READ_PRODUCT] });
    expect(hasAnyPermission(user, Permission.DELETE_PRODUCT, Permission.READ_PRODUCT)).toBe(true);
  });

  it('returns false when the user has none of the specified permissions', () => {
    const user = makeUser({ permissions: [Permission.READ_PRODUCT] });
    expect(hasAnyPermission(user, Permission.DELETE_PRODUCT, Permission.MANAGE_SYSTEM)).toBe(false);
  });

  it('returns false for null user', () => {
    expect(hasAnyPermission(null, Permission.READ_PRODUCT)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// belongsToGroup
// ---------------------------------------------------------------------------

describe('belongsToGroup', () => {
  it('returns true when user.groups includes the group code', () => {
    const user = makeUser({ groups: ['sales', 'support'] });
    expect(belongsToGroup(user, 'sales')).toBe(true);
  });

  it('returns false when user.groups does not include the group code', () => {
    const user = makeUser({ groups: ['sales'] });
    expect(belongsToGroup(user, 'administrators')).toBe(false);
  });

  it('returns false when user is null', () => {
    expect(belongsToGroup(null, 'administrators')).toBe(false);
  });

  it('returns false when the token is old shape (no groups field)', () => {
    const user = makeUser(); // no `groups` property
    expect(belongsToGroup(user, 'administrators')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// belongsToAnyGroup
// ---------------------------------------------------------------------------

describe('belongsToAnyGroup', () => {
  it('returns true when user belongs to at least one of the groups', () => {
    const user = makeUser({ groups: ['support'] });
    expect(belongsToAnyGroup(user, 'administrators', 'support')).toBe(true);
  });

  it('returns false when user belongs to none of the groups', () => {
    const user = makeUser({ groups: ['support'] });
    expect(belongsToAnyGroup(user, 'administrators', 'billing')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isAdmin
// ---------------------------------------------------------------------------

describe('isAdmin', () => {
  it('returns true when role === "admin" (legacy token)', () => {
    const user = makeUser({ role: UserRole.ADMIN });
    expect(isAdmin(user)).toBe(true);
  });

  it('returns true when user belongs to group "administrators" (new token)', () => {
    const user = makeUser({ role: UserRole.CUSTOMER, groups: ['administrators'] });
    expect(isAdmin(user)).toBe(true);
  });

  it('returns false for a customer without admin group', () => {
    const user = makeUser({ role: UserRole.CUSTOMER, groups: ['support'] });
    expect(isAdmin(user)).toBe(false);
  });

  it('returns false for null user', () => {
    expect(isAdmin(null)).toBe(false);
  });
});
