/**
 * Unit tests for StreamRecordRuleSource.
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

import { StreamRecordRuleSource } from '../stream-record-rule-source';
import type { RecordRule } from '../record-rule-resolver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRule(overrides: Partial<RecordRule> = {}): RecordRule {
  return {
    id: 'rule-1',
    modelName: 'Order',
    groupCode: 'sales-user',
    mode: 'read',
    domainExpression: { op: 'eq', field: 'status', value: 'confirmed' },
    isActive: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StreamRecordRuleSource', () => {
  it('starts empty — loadAllActive returns []', async () => {
    const source = new StreamRecordRuleSource();
    await expect(source.loadAllActive()).resolves.toEqual([]);
  });

  describe('upsert()', () => {
    it('adds a rule so it appears in loadAllActive', async () => {
      const source = new StreamRecordRuleSource();
      const rule = makeRule();

      source.upsert(rule);

      const active = await source.loadAllActive();
      expect(active).toHaveLength(1);
      expect(active[0]).toEqual(rule);
    });

    it('replaces an existing rule with the same id', async () => {
      const source = new StreamRecordRuleSource();
      const original = makeRule({ modelName: 'Order' });
      const updated = makeRule({ modelName: 'Product' });

      source.upsert(original);
      source.upsert(updated);

      const active = await source.loadAllActive();
      expect(active).toHaveLength(1);
      expect(active[0].modelName).toBe('Product');
    });

    it('can hold multiple rules with different ids', async () => {
      const source = new StreamRecordRuleSource();
      source.upsert(makeRule({ id: 'r1' }));
      source.upsert(makeRule({ id: 'r2' }));

      const active = await source.loadAllActive();
      expect(active).toHaveLength(2);
    });
  });

  describe('remove()', () => {
    it('removes a rule by id', async () => {
      const source = new StreamRecordRuleSource();
      source.upsert(makeRule({ id: 'r1' }));
      source.upsert(makeRule({ id: 'r2' }));

      source.remove('r1');

      const active = await source.loadAllActive();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('r2');
    });

    it('is a no-op when id does not exist', async () => {
      const source = new StreamRecordRuleSource();
      source.upsert(makeRule({ id: 'r1' }));

      source.remove('nonexistent');

      const active = await source.loadAllActive();
      expect(active).toHaveLength(1);
    });
  });

  describe('loadAllActive()', () => {
    it('filters out inactive rules', async () => {
      const source = new StreamRecordRuleSource();
      source.upsert(makeRule({ id: 'active', isActive: true }));
      source.upsert(makeRule({ id: 'inactive', isActive: false }));

      const active = await source.loadAllActive();

      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('active');
    });

    it('returns all rules when all are active', async () => {
      const source = new StreamRecordRuleSource();
      source.upsert(makeRule({ id: 'r1', isActive: true }));
      source.upsert(makeRule({ id: 'r2', isActive: true }));

      const active = await source.loadAllActive();
      expect(active).toHaveLength(2);
    });

    it('returns empty when all rules are inactive', async () => {
      const source = new StreamRecordRuleSource();
      source.upsert(makeRule({ id: 'r1', isActive: false }));
      source.upsert(makeRule({ id: 'r2', isActive: false }));

      const active = await source.loadAllActive();
      expect(active).toHaveLength(0);
    });
  });
});
