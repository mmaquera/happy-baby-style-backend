import { compileDomainExpr, DomainExprSchema } from '../domain-expression';
import { UserRole, Permission } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';
import { ZodError } from 'zod';

// domain-expression.ts does not use @hbs/logging — no mock needed.

// ---------------------------------------------------------------------------
// Test factory
// ---------------------------------------------------------------------------

function makeUser(overrides?: Partial<TokenPayload>): TokenPayload {
  return {
    userId: 'u1',
    email: 'test@example.com',
    role: UserRole.CUSTOMER,
    permissions: [Permission.READ_PRODUCT],
    ...overrides,
  };
}

const ctx = (user: TokenPayload | null = makeUser()) => ({ currentUser: user });

// ---------------------------------------------------------------------------
// Schema validation — DomainExprSchema.parse
// ---------------------------------------------------------------------------

describe('DomainExprSchema validation', () => {
  it('accepts a valid comparison expression', () => {
    expect(() =>
      DomainExprSchema.parse({ op: 'eq', field: 'userId', value: 'abc' }),
    ).not.toThrow();
  });

  it('accepts a valid $ctx reference', () => {
    expect(() =>
      DomainExprSchema.parse({ op: 'eq', field: 'userId', value: { $ctx: 'current_user.id' } }),
    ).not.toThrow();
  });

  it('accepts nested logical and', () => {
    expect(() =>
      DomainExprSchema.parse({
        op: 'and',
        args: [
          { op: 'eq', field: 'status', value: 'active' },
          { op: 'gt', field: 'amount', value: 100 },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects an unknown comparison operator', () => {
    expect(() =>
      DomainExprSchema.parse({ op: 'contains', field: 'name', value: 'foo' }),
    ).toThrow(ZodError);
  });

  it('rejects an invalid field path (starts with digit)', () => {
    expect(() =>
      DomainExprSchema.parse({ op: 'eq', field: '1invalid', value: 'x' }),
    ).toThrow(ZodError);
  });

  it('rejects a $ctx path with invalid characters', () => {
    expect(() =>
      DomainExprSchema.parse({ op: 'eq', field: 'userId', value: { $ctx: '!bad path' } }),
    ).toThrow(ZodError);
  });

  it('rejects a logical and with empty args array', () => {
    expect(() =>
      DomainExprSchema.parse({ op: 'and', args: [] }),
    ).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// compileDomainExpr — simple comparisons
// ---------------------------------------------------------------------------

describe('compileDomainExpr — simple comparison', () => {
  it('compiles eq with a literal value', () => {
    const result = compileDomainExpr({ op: 'eq', field: 'status', value: 'active' }, ctx());
    expect(result).toEqual({ status: { equals: 'active' } });
  });

  it('compiles neq with a literal value', () => {
    const result = compileDomainExpr({ op: 'neq', field: 'status', value: 'deleted' }, ctx());
    expect(result).toEqual({ status: { not: 'deleted' } });
  });

  it('compiles in with an array value', () => {
    const result = compileDomainExpr(
      { op: 'in', field: 'role', value: ['admin', 'staff'] },
      ctx(),
    );
    expect(result).toEqual({ role: { in: ['admin', 'staff'] } });
  });

  it('compiles not_in with an array value', () => {
    const result = compileDomainExpr(
      { op: 'not_in', field: 'status', value: ['cancelled', 'deleted'] },
      ctx(),
    );
    expect(result).toEqual({ status: { notIn: ['cancelled', 'deleted'] } });
  });

  it('resolves $ctx.current_user.id against the current user', () => {
    const user = makeUser({ userId: 'u42' });
    const result = compileDomainExpr(
      { op: 'eq', field: 'userId', value: { $ctx: 'current_user.id' } },
      ctx(user),
    );
    expect(result).toEqual({ userId: { equals: 'u42' } });
  });

  it('resolves $ctx.current_user.email', () => {
    const user = makeUser({ email: 'marco@example.com' });
    const result = compileDomainExpr(
      { op: 'eq', field: 'email', value: { $ctx: 'current_user.email' } },
      ctx(user),
    );
    expect(result).toEqual({ email: { equals: 'marco@example.com' } });
  });

  it('resolves $ctx.current_user.role', () => {
    const user = makeUser({ role: UserRole.ADMIN });
    const result = compileDomainExpr(
      { op: 'eq', field: 'role', value: { $ctx: 'current_user.role' } },
      ctx(user),
    );
    expect(result).toEqual({ role: { equals: 'admin' } });
  });
});

// ---------------------------------------------------------------------------
// compileDomainExpr — logical operators
// ---------------------------------------------------------------------------

describe('compileDomainExpr — logical operators', () => {
  it('compiles a top-level AND', () => {
    const result = compileDomainExpr(
      {
        op: 'and',
        args: [
          { op: 'eq', field: 'status', value: 'active' },
          { op: 'eq', field: 'userId', value: { $ctx: 'current_user.id' } },
        ],
      },
      ctx(makeUser({ userId: 'u1' })),
    );
    expect(result).toEqual({
      AND: [
        { status: { equals: 'active' } },
        { userId: { equals: 'u1' } },
      ],
    });
  });

  it('compiles a top-level OR', () => {
    const result = compileDomainExpr(
      {
        op: 'or',
        args: [
          { op: 'eq', field: 'role', value: 'admin' },
          { op: 'eq', field: 'role', value: 'staff' },
        ],
      },
      ctx(),
    );
    expect(result).toEqual({
      OR: [
        { role: { equals: 'admin' } },
        { role: { equals: 'staff' } },
      ],
    });
  });

  it('compiles a NOT', () => {
    const result = compileDomainExpr(
      { op: 'not', arg: { op: 'eq', field: 'deleted', value: true } },
      ctx(),
    );
    expect(result).toEqual({ NOT: { deleted: { equals: true } } });
  });

  it('compiles nested AND inside OR', () => {
    const result = compileDomainExpr(
      {
        op: 'or',
        args: [
          { op: 'eq', field: 'role', value: 'admin' },
          {
            op: 'and',
            args: [
              { op: 'eq', field: 'role', value: 'staff' },
              { op: 'eq', field: 'active', value: true },
            ],
          },
        ],
      },
      ctx(),
    );
    expect(result).toEqual({
      OR: [
        { role: { equals: 'admin' } },
        {
          AND: [
            { role: { equals: 'staff' } },
            { active: { equals: true } },
          ],
        },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// compileDomainExpr — nested field paths
// ---------------------------------------------------------------------------

describe('compileDomainExpr — nested field paths', () => {
  it('compiles a single-level dotted field', () => {
    const result = compileDomainExpr(
      { op: 'eq', field: 'order.status', value: 'pending' },
      ctx(),
    );
    expect(result).toEqual({ order: { status: { equals: 'pending' } } });
  });

  it('compiles a two-level dotted field', () => {
    const result = compileDomainExpr(
      { op: 'eq', field: 'order.user.id', value: 'u1' },
      ctx(),
    );
    expect(result).toEqual({ order: { user: { id: { equals: 'u1' } } } });
  });
});

// ---------------------------------------------------------------------------
// compileDomainExpr — error cases
// ---------------------------------------------------------------------------

describe('compileDomainExpr — error cases', () => {
  it('throws ZodError for an invalid expression shape', () => {
    expect(() =>
      compileDomainExpr({ op: 'unknown_op', field: 'x', value: 1 }, ctx()),
    ).toThrow(ZodError);
  });

  it('throws when $ctx path is not current_user.*', () => {
    expect(() =>
      compileDomainExpr(
        { op: 'eq', field: 'tenantId', value: { $ctx: 'tenant.id' } },
        ctx(),
      ),
    ).toThrow('Unsupported $ctx path');
  });

  it('throws when $ctx current_user field is not whitelisted', () => {
    expect(() =>
      compileDomainExpr(
        { op: 'eq', field: 'iat', value: { $ctx: 'current_user.iat' } },
        ctx(),
      ),
    ).toThrow('Unknown current_user field');
  });

  it('handles null currentUser for $ctx.current_user.id — returns null', () => {
    const result = compileDomainExpr(
      { op: 'eq', field: 'userId', value: { $ctx: 'current_user.id' } },
      { currentUser: null },
    );
    expect(result).toEqual({ userId: { equals: undefined } });
  });
});
