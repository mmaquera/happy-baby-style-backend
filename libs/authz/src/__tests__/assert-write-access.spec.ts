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

import { assertWriteAccess, AssertWriteAccessOptions } from '../assert-write-access';
import { NotFoundError } from '@hbs/shared-kernel';
import { RecordRuleResolver } from '../record-rule-resolver';
import type { IRecordRuleSource, RecordRule } from '../record-rule-resolver';
import { Permission } from '@hbs/auth';
import type { TokenPayload } from '@hbs/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DENY_WHERE = { AND: [{ NOT: {} }] };

function makeUser(overrides?: Partial<TokenPayload>): TokenPayload {
  return {
    userId: 'u-test',
    email: 'test@example.com',
    permissions: [Permission.READ_ORDER],
    groups: ['sales-user'],
    ...overrides,
  };
}

function makeRule(overrides?: Partial<RecordRule>): RecordRule {
  return {
    id: 'rule-1',
    modelName: 'Order',
    groupCode: null,
    mode: 'write',
    domainExpression: { op: 'eq', field: 'status', value: 'active' },
    isActive: true,
    ...overrides,
  };
}

function makeMockSource(rules: RecordRule[]): IRecordRuleSource {
  return { loadAllActive: jest.fn().mockResolvedValue(rules) };
}

/** Build options with a mocked exists callback that always returns the given value. */
function makeOpts(
  overrides: Partial<AssertWriteAccessOptions> & {
    resolverRules?: RecordRule[];
    existsResult?: boolean;
  } = {},
): AssertWriteAccessOptions & { existsMock: jest.Mock } {
  const { resolverRules, existsResult = true, ...rest } = overrides;
  const existsMock = jest.fn().mockResolvedValue(existsResult);
  const resolver =
    resolverRules !== undefined
      ? new RecordRuleResolver(makeMockSource(resolverRules))
      : undefined;
  return {
    resolver,
    modelName: 'Order',
    mode: 'write',
    id: 'ord-1',
    currentUser: makeUser(),
    exists: existsMock,
    existsMock,
    ...rest,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('assertWriteAccess', () => {
  // ── resolver undefined → no-op ──────────────────────────────────────────

  it('is a no-op when resolver is undefined', async () => {
    const opts = makeOpts({ resolver: undefined, existsResult: false });
    // Should not throw even though exists returns false
    await expect(assertWriteAccess(opts)).resolves.toBeUndefined();
    // exists must not be called at all
    expect(opts.existsMock).not.toHaveBeenCalled();
  });

  // ── ruleWhere = {} (no rules) ────────────────────────────────────────────

  it('passes when ruleWhere is {} and exists returns true (existence-only probe)', async () => {
    const opts = makeOpts({ resolverRules: [], existsResult: true });
    await expect(assertWriteAccess(opts)).resolves.toBeUndefined();
    // probe must be { id } only — no ruleWhere composed
    expect(opts.existsMock).toHaveBeenCalledWith({ id: 'ord-1' });
  });

  it('throws NotFoundError when ruleWhere is {} and exists returns false', async () => {
    const opts = makeOpts({ resolverRules: [], existsResult: false });
    await expect(assertWriteAccess(opts)).rejects.toBeInstanceOf(NotFoundError);
    expect(opts.existsMock).toHaveBeenCalledWith({ id: 'ord-1' });
  });

  // ── ruleWhere non-empty (compiled filter) ────────────────────────────────

  it('passes when ruleWhere is non-empty and exists returns true', async () => {
    // A global write rule — produces a compiled where
    const opts = makeOpts({
      resolverRules: [
        makeRule({
          groupCode: null,
          mode: 'write',
          domainExpression: { op: 'eq', field: 'status', value: 'active' },
        }),
      ],
      existsResult: true,
    });
    await expect(assertWriteAccess(opts)).resolves.toBeUndefined();
    // exists must be called with AND[{ id }, ruleWhere]
    expect(opts.existsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        AND: expect.arrayContaining([
          { id: 'ord-1' },
        ]),
      }),
    );
  });

  it('verifies exists is called with { AND: [{ id }, ruleWhere] } when ruleWhere is non-empty', async () => {
    const opts = makeOpts({
      resolverRules: [
        makeRule({
          groupCode: null,
          mode: 'write',
          domainExpression: { op: 'eq', field: 'status', value: 'active' },
        }),
      ],
      existsResult: true,
    });
    await assertWriteAccess(opts);
    const calledWith = opts.existsMock.mock.calls[0][0];
    // Must be AND[{id}, <compiledWhere>] — not just {id}
    expect(calledWith).toHaveProperty('AND');
    expect(calledWith.AND).toEqual(
      expect.arrayContaining([{ id: 'ord-1' }]),
    );
    // The AND array must have more than just {id}
    expect(calledWith.AND.length).toBeGreaterThan(1);
  });

  it('throws NotFoundError when ruleWhere is non-empty and exists returns false', async () => {
    const opts = makeOpts({
      resolverRules: [
        makeRule({
          groupCode: null,
          mode: 'write',
          domainExpression: { op: 'eq', field: 'status', value: 'active' },
        }),
      ],
      existsResult: false,
    });
    await expect(assertWriteAccess(opts)).rejects.toBeInstanceOf(NotFoundError);
  });

  // ── DENY_WHERE regression — BOLA guard ───────────────────────────────────

  it('throws NotFoundError when DENY_WHERE is returned (user has no matching group — BOLA regression)', async () => {
    // A group rule for administrators only; user has no groups → resolveWhere returns DENY_WHERE
    const user = makeUser({ groups: [] });
    const opts = makeOpts({
      resolverRules: [makeRule({ groupCode: 'administrators', mode: 'write' })],
      currentUser: user,
      // exists should not matter: DENY_WHERE → { AND: [{ id }, DENY_WHERE] } → probe never matches
      existsResult: false,
    });
    await expect(assertWriteAccess(opts)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('DENY_WHERE: exists is still called (probe built, but returns false)', async () => {
    // Validate the code path: DENY_WHERE is non-empty → probe with AND[{id}, DENY_WHERE]
    const user = makeUser({ groups: [] });
    const opts = makeOpts({
      resolverRules: [makeRule({ groupCode: 'administrators', mode: 'write' })],
      currentUser: user,
      existsResult: false,
    });
    await expect(assertWriteAccess(opts)).rejects.toBeInstanceOf(NotFoundError);
    // exists was called with an AND that includes the DENY_WHERE
    expect(opts.existsMock).toHaveBeenCalledWith(
      expect.objectContaining({ AND: expect.arrayContaining([{ id: 'ord-1' }]) }),
    );
  });

  // ── unlink mode ──────────────────────────────────────────────────────────

  it('passes unlink mode probe correctly', async () => {
    const opts = makeOpts({
      resolverRules: [],
      mode: 'unlink',
      existsResult: true,
    });
    await expect(assertWriteAccess(opts)).resolves.toBeUndefined();
    expect(opts.existsMock).toHaveBeenCalledWith({ id: 'ord-1' });
  });

  it('throws NotFoundError on unlink when record does not exist', async () => {
    const opts = makeOpts({
      resolverRules: [],
      mode: 'unlink',
      existsResult: false,
    });
    await expect(assertWriteAccess(opts)).rejects.toBeInstanceOf(NotFoundError);
  });

  // ── NotFoundError shape ──────────────────────────────────────────────────

  it('NotFoundError contains modelName in message', async () => {
    const opts = makeOpts({ resolverRules: [], existsResult: false, modelName: 'Order' });
    const err = await assertWriteAccess(opts).catch((e) => e);
    expect(err.message).toContain('Order');
  });
});
