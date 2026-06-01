import { RecordRuleResolver } from '../record-rule-resolver';
import type { IRecordRuleSource, RecordRule } from '../record-rule-resolver';
import { UserRole, Permission } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';

// RecordRuleResolver now uses @hbs/logging — mock required.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides?: Partial<TokenPayload>): TokenPayload {
  return {
    userId: 'u1',
    email: 'test@example.com',
    role: UserRole.CUSTOMER,
    permissions: [Permission.READ_ORDER],
    groups: [],
    ...overrides,
  };
}

function makeRule(overrides?: Partial<RecordRule>): RecordRule {
  return {
    id: 'rule-1',
    modelName: 'Order',
    groupCode: null,
    mode: 'read',
    domainExpression: { op: 'eq', field: 'userId', value: { $ctx: 'current_user.id' } },
    isActive: true,
    ...overrides,
  };
}

function makeMockSource(rules: RecordRule[]): IRecordRuleSource {
  return {
    loadAllActive: jest.fn().mockResolvedValue(rules),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecordRuleResolver.resolveWhere', () => {
  // ---- No rules -------------------------------------------------------

  it('returns {} when no rules exist for the model+mode', async () => {
    const source = makeMockSource([]);
    const resolver = new RecordRuleResolver(source);

    const result = await resolver.resolveWhere('Order', 'read', makeUser());

    expect(result).toEqual({});
  });

  it('returns {} when rules exist for a different model', async () => {
    const source = makeMockSource([makeRule({ modelName: 'Product' })]);
    const resolver = new RecordRuleResolver(source);

    const result = await resolver.resolveWhere('Order', 'read', makeUser());

    expect(result).toEqual({});
  });

  it('returns {} when rules exist for a different mode', async () => {
    const source = makeMockSource([makeRule({ mode: 'write' })]);
    const resolver = new RecordRuleResolver(source);

    const result = await resolver.resolveWhere('Order', 'read', makeUser());

    expect(result).toEqual({});
  });

  // ---- Global rule match -----------------------------------------------

  it('returns compiled where for a global rule when user is authenticated', async () => {
    const user = makeUser({ userId: 'u42' });
    const source = makeMockSource([
      makeRule({
        groupCode: null,
        domainExpression: { op: 'eq', field: 'userId', value: { $ctx: 'current_user.id' } },
      }),
    ]);
    const resolver = new RecordRuleResolver(source);

    const result = await resolver.resolveWhere('Order', 'read', user);

    // Single global rule → wrapped in AND
    expect(result).toEqual({ AND: [{ userId: { equals: 'u42' } }] });
  });

  it('returns AND of multiple global wheres', async () => {
    const user = makeUser({ userId: 'u1' });
    const source = makeMockSource([
      makeRule({
        id: 'rule-1',
        groupCode: null,
        domainExpression: { op: 'eq', field: 'userId', value: { $ctx: 'current_user.id' } },
      }),
      makeRule({
        id: 'rule-2',
        groupCode: null,
        domainExpression: { op: 'eq', field: 'status', value: 'active' },
      }),
    ]);
    const resolver = new RecordRuleResolver(source);

    const result = await resolver.resolveWhere('Order', 'read', user);

    expect(result).toEqual({
      AND: [
        { userId: { equals: 'u1' } },
        { status: { equals: 'active' } },
      ],
    });
  });

  // ---- Group-specific rules -------------------------------------------

  it('returns compiled where when user belongs to the rule group', async () => {
    const user = makeUser({ userId: 'u1', groups: ['sales-manager'] });
    const source = makeMockSource([
      makeRule({
        groupCode: 'sales-manager',
        domainExpression: { op: 'eq', field: 'userId', value: { $ctx: 'current_user.id' } },
      }),
    ]);
    const resolver = new RecordRuleResolver(source);

    const result = await resolver.resolveWhere('Order', 'read', user);

    // Single matching group rule → wrapped in OR
    expect(result).toEqual({ OR: [{ userId: { equals: 'u1' } }] });
  });

  it('returns impossible where when group rules exist but user has no matching group', async () => {
    const user = makeUser({ groups: ['customer'] });
    const source = makeMockSource([
      makeRule({ groupCode: 'administrators' }),
    ]);
    const resolver = new RecordRuleResolver(source);

    const result = await resolver.resolveWhere('Order', 'read', user);

    // Model-agnostic deny: must NOT use { id: { in: [] } } (field-specific)
    expect(result).toEqual({ AND: [{ NOT: {} }] });
    expect(result).not.toHaveProperty('id');
  });

  it('returns impossible where when user has empty groups and group rule exists', async () => {
    const user = makeUser({ groups: [] });
    const source = makeMockSource([makeRule({ groupCode: 'administrators' })]);
    const resolver = new RecordRuleResolver(source);

    const result = await resolver.resolveWhere('Order', 'read', user);

    expect(result).toEqual({ AND: [{ NOT: {} }] });
    expect(result).not.toHaveProperty('id');
  });

  // ---- Mix global + group rules ----------------------------------------

  it('combines AND(globals) + OR(group matches) correctly', async () => {
    const user = makeUser({ userId: 'u1', groups: ['sales-manager'] });
    const source = makeMockSource([
      makeRule({
        id: 'global-1',
        groupCode: null,
        domainExpression: { op: 'eq', field: 'status', value: 'active' },
      }),
      makeRule({
        id: 'group-1',
        groupCode: 'sales-manager',
        domainExpression: { op: 'eq', field: 'userId', value: { $ctx: 'current_user.id' } },
      }),
    ]);
    const resolver = new RecordRuleResolver(source);

    const result = await resolver.resolveWhere('Order', 'read', user);

    // AND [ AND(globals), OR(groups) ]
    expect(result).toEqual({
      AND: [
        { AND: [{ status: { equals: 'active' } }] },
        { OR: [{ userId: { equals: 'u1' } }] },
      ],
    });
  });

  it('grants access via globals even when group rules exist but none match', async () => {
    // If global rules exist but no group rules match → globals still apply (not denied)
    const user = makeUser({ groups: ['customer'] });
    const source = makeMockSource([
      makeRule({
        id: 'global-1',
        groupCode: null,
        domainExpression: { op: 'eq', field: 'status', value: 'active' },
      }),
      makeRule({
        id: 'group-1',
        groupCode: 'administrators',
        domainExpression: { op: 'eq', field: 'isInternal', value: true },
      }),
    ]);
    const resolver = new RecordRuleResolver(source);

    const result = await resolver.resolveWhere('Order', 'read', user);

    // Global applies; no matching group → only AND(globals)
    expect(result).toEqual({ AND: [{ status: { equals: 'active' } }] });
  });

  // ---- Null user --------------------------------------------------------

  it('returns impossible where when user is null and rules exist', async () => {
    const source = makeMockSource([makeRule({ groupCode: null })]);
    const resolver = new RecordRuleResolver(source);

    const result = await resolver.resolveWhere('Order', 'read', null);

    expect(result).toEqual({ AND: [{ NOT: {} }] });
    expect(result).not.toHaveProperty('id');
  });

  it('returns {} when user is null and NO rules exist', async () => {
    const source = makeMockSource([]);
    const resolver = new RecordRuleResolver(source);

    const result = await resolver.resolveWhere('Order', 'read', null);

    expect(result).toEqual({});
  });

  // ---- Cache behaviour ------------------------------------------------

  it('calls loadAllActive only once on repeated resolveWhere (cache hit)', async () => {
    const source = makeMockSource([]);
    const resolver = new RecordRuleResolver(source, { cacheTtlMs: 60_000 });

    await resolver.resolveWhere('Order', 'read', makeUser());
    await resolver.resolveWhere('Order', 'read', makeUser());
    await resolver.resolveWhere('Product', 'write', makeUser());

    expect(source.loadAllActive).toHaveBeenCalledTimes(1);
  });

  it('reload triggered manually via refresh()', async () => {
    const source = makeMockSource([]);
    const resolver = new RecordRuleResolver(source, { cacheTtlMs: 60_000 });

    await resolver.resolveWhere('Order', 'read', makeUser());
    await resolver.refresh();
    await resolver.resolveWhere('Order', 'read', makeUser());

    expect(source.loadAllActive).toHaveBeenCalledTimes(2);
  });

  it('auto-reloads after TTL expires', async () => {
    const source = makeMockSource([]);
    // TTL = 0ms → always expired
    const resolver = new RecordRuleResolver(source, { cacheTtlMs: 0 });

    await resolver.resolveWhere('Order', 'read', makeUser());
    await resolver.resolveWhere('Order', 'read', makeUser());

    // Each call should reload because TTL is 0
    expect(source.loadAllActive).toHaveBeenCalledTimes(2);
  });

  // ---- Issue #1: corrupt domainExpression skipped (fail-closed) ----------

  it('skips a rule with corrupt domainExpression and does not throw', async () => {
    const user = makeUser({ userId: 'u1' });
    const source = makeMockSource([
      // Valid rule
      makeRule({
        id: 'rule-valid',
        groupCode: null,
        domainExpression: { op: 'eq', field: 'status', value: 'active' },
      }),
      // Corrupt rule — domainExpression is invalid JSON/schema
      makeRule({
        id: 'rule-corrupt',
        groupCode: null,
        domainExpression: { garbage: true, completely: 'wrong' },
      }),
    ]);
    const resolver = new RecordRuleResolver(source);

    // Must not throw — corrupt rule is skipped
    const result = await resolver.resolveWhere('Order', 'read', user);

    // Only the valid rule contributes
    expect(result).toEqual({ AND: [{ status: { equals: 'active' } }] });
  });

  it('returns DENY_WHERE (model-agnostic, no id field) for all deny paths', async () => {
    const source = makeMockSource([makeRule({ groupCode: 'administrators' })]);
    const resolver = new RecordRuleResolver(source);

    // Unauthenticated user
    const resultNull = await resolver.resolveWhere('Order', 'read', null);
    expect(resultNull).toEqual({ AND: [{ NOT: {} }] });
    expect(resultNull).not.toHaveProperty('id');

    // Authenticated user with no matching group
    const resultNoGroup = await resolver.resolveWhere('Order', 'read', makeUser({ groups: ['customer'] }));
    expect(resultNoGroup).toEqual({ AND: [{ NOT: {} }] });
    expect(resultNoGroup).not.toHaveProperty('id');
  });

  // ---- Issue #3: singleflight on concurrent refresh() calls --------------

  it('issues only one loadAllActive call when refresh() is called concurrently', async () => {
    const source = makeMockSource([]);
    const resolver = new RecordRuleResolver(source, { cacheTtlMs: 60_000 });

    // Fire 10 concurrent refresh() calls
    await Promise.all(Array.from({ length: 10 }, () => resolver.refresh()));

    expect(source.loadAllActive).toHaveBeenCalledTimes(1);
  });
});
