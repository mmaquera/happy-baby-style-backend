import { requireGroup, requireAnyGroup } from '@hbs/auth';
import { Permission } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';

// requireGroup / requireAnyGroup do not use @hbs/logging — no mock needed.

// ---------------------------------------------------------------------------
// Test factory
// ---------------------------------------------------------------------------

function makeUser(overrides?: Partial<TokenPayload>): TokenPayload {
  return {
    userId: 'user-1',
    email: 'test@example.com',
    permissions: [Permission.READ_PRODUCT],
    groups: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// requireGroup
// ---------------------------------------------------------------------------

describe('requireGroup', () => {
  it('throws UNAUTHENTICATED when currentUser is null', () => {
    expect(() => requireGroup(null, 'sales')).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      }),
    );
  });

  it('throws UNAUTHENTICATED when currentUser is undefined', () => {
    expect(() => requireGroup(undefined, 'sales')).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      }),
    );
  });

  it('throws FORBIDDEN when the user has an empty groups array', () => {
    const user = makeUser({ groups: [] });
    expect(() => requireGroup(user, 'sales')).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'FORBIDDEN' }),
      }),
    );
  });

  it('throws FORBIDDEN when the user has other groups but not the required one', () => {
    const user = makeUser({ groups: ['support', 'billing'] });
    expect(() => requireGroup(user, 'sales')).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'FORBIDDEN' }),
      }),
    );
  });

  it('does not throw when the user belongs to the required group', () => {
    const user = makeUser({ groups: ['sales', 'support'] });
    expect(() => requireGroup(user, 'sales')).not.toThrow();
  });

  it('error message does not leak the group code', () => {
    const user = makeUser({ groups: [] });
    let errorMessage = '';
    try {
      requireGroup(user, 'internal-secret-group');
    } catch (e: any) {
      errorMessage = e.message;
    }
    expect(errorMessage).not.toContain('internal-secret-group');
    expect(errorMessage).toBe('Insufficient privileges');
  });
});

// ---------------------------------------------------------------------------
// requireAnyGroup
// ---------------------------------------------------------------------------

describe('requireAnyGroup', () => {
  it('throws UNAUTHENTICATED when currentUser is null', () => {
    expect(() => requireAnyGroup(null, 'sales', 'support')).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      }),
    );
  });

  it('throws UNAUTHENTICATED when currentUser is undefined', () => {
    expect(() => requireAnyGroup(undefined, 'sales')).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      }),
    );
  });

  it('throws FORBIDDEN when the user belongs to none of the listed groups', () => {
    const user = makeUser({ groups: ['billing'] });
    expect(() => requireAnyGroup(user, 'sales', 'support', 'administrators')).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'FORBIDDEN' }),
      }),
    );
  });

  it('throws FORBIDDEN when the user has an empty groups array', () => {
    const user = makeUser({ groups: [] });
    expect(() => requireAnyGroup(user, 'sales', 'support')).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'FORBIDDEN' }),
      }),
    );
  });

  it('does not throw when the user belongs to at least one of the listed groups', () => {
    const user = makeUser({ groups: ['billing', 'support'] });
    expect(() => requireAnyGroup(user, 'sales', 'support')).not.toThrow();
  });

  it('does not throw when the user belongs to all of the listed groups', () => {
    const user = makeUser({ groups: ['sales', 'support'] });
    expect(() => requireAnyGroup(user, 'sales', 'support')).not.toThrow();
  });

  it('error message does not leak group codes', () => {
    const user = makeUser({ groups: [] });
    let errorMessage = '';
    try {
      requireAnyGroup(user, 'secret-group-a', 'secret-group-b');
    } catch (e: any) {
      errorMessage = e.message;
    }
    expect(errorMessage).not.toContain('secret-group-a');
    expect(errorMessage).toBe('Insufficient privileges');
  });
});
