/**
 * Tests for RecordRulesEventsConsumer payload-processing behavior (Fase 5.8).
 *
 * These tests cover the StreamRecordRuleSource integration:
 *  - rule.created / rule.updated events → source.upsert + resolver.refresh
 *  - rule.deleted events → source.remove + resolver.refresh
 *  - missing payload → warn + skip upsert (no crash)
 *  - no streamSource → only resolver.refresh (backward-compat with user-service)
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

import { RecordRulesEventsConsumer } from '../record-rules-events-consumer';
import { StreamRecordRuleSource } from '../stream-record-rule-source';
import type { RecordRulesConsumerOptions } from '../record-rules-events-consumer';
import type { RecordRule } from '../record-rule-resolver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockLogger() {
  const logger: any = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  logger.child = jest.fn().mockReturnValue(logger);
  return logger;
}

function makeMockResolver() {
  return { refresh: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeMockRedis() {
  return {
    xgroup: jest.fn().mockResolvedValue('OK'),
    xreadgroup: jest.fn().mockResolvedValue(null),
    xack: jest.fn().mockResolvedValue(1),
    xautoclaim: jest.fn().mockResolvedValue(['0', [], []]),
  } as any;
}

function makeOptions(): RecordRulesConsumerOptions {
  return {
    streamName: 'stream:record-rules-updated',
    consumerGroup: 'order-service-rbac-cg',
    consumerName: 'order-consumer-1',
  };
}

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

/** Serializes a rule snapshot into XADD-style flat field array */
function makeCreatedEntry(rule: RecordRule, id = '1717000000000-0'): [string, string[]] {
  return [
    id,
    [
      'eventId', 'uuid-1',
      'eventType', 'rule.created',
      'ruleId', rule.id,
      'emittedAt', new Date().toISOString(),
      'rule', JSON.stringify({
        id: rule.id,
        name: 'test-rule',
        modelName: rule.modelName,
        groupCode: rule.groupCode,
        mode: rule.mode,
        domainExpression: rule.domainExpression,
        isActive: rule.isActive,
      }),
    ],
  ];
}

function makeDeletedEntry(ruleId: string, id = '1717000000001-0'): [string, string[]] {
  return [
    id,
    [
      'eventId', 'uuid-del',
      'eventType', 'rule.deleted',
      'ruleId', ruleId,
      'emittedAt', new Date().toISOString(),
    ],
  ];
}

/** Creates a consumer with loop stubbed out */
function makeConsumer(
  redis: any,
  resolver: any,
  logger: any,
  streamSource?: StreamRecordRuleSource,
): RecordRulesEventsConsumer {
  const consumer = new RecordRulesEventsConsumer(
    redis,
    resolver,
    logger,
    makeOptions(),
    streamSource,
  ) as any;
  consumer.loop = jest.fn().mockResolvedValue(undefined);
  return consumer as RecordRulesEventsConsumer;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecordRulesEventsConsumer — payload processing with StreamRecordRuleSource', () => {
  afterEach(() => jest.clearAllMocks());

  describe('rule.created event', () => {
    it('calls source.upsert + resolver.refresh', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      const source = new StreamRecordRuleSource();
      jest.spyOn(source, 'upsert');

      const consumer = makeConsumer(redis, resolver, makeMockLogger(), source) as any;
      const rule = makeRule();
      const entries = [makeCreatedEntry(rule)];

      await consumer.processBatch(entries);

      expect(source.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: rule.id, modelName: rule.modelName }),
      );
      expect(resolver.refresh).toHaveBeenCalledTimes(1);
      expect(redis.xack).toHaveBeenCalledWith(
        'stream:record-rules-updated',
        'order-service-rbac-cg',
        '1717000000000-0',
      );
    });

    it('rule is accessible via loadAllActive after processing', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      const source = new StreamRecordRuleSource();

      const consumer = makeConsumer(redis, resolver, makeMockLogger(), source) as any;
      const rule = makeRule();
      await consumer.processBatch([makeCreatedEntry(rule)]);

      const active = await source.loadAllActive();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(rule.id);
    });
  });

  describe('rule.updated event', () => {
    it('upserts updated rule — replaces existing entry in source', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      const source = new StreamRecordRuleSource();

      // Seed an original rule
      const original = makeRule({ isActive: true, groupCode: 'old-group' });
      source.upsert(original);

      const consumer = makeConsumer(redis, resolver, makeMockLogger(), source) as any;

      // Updated event: same id, different groupCode
      const updated = makeRule({ isActive: true, groupCode: 'new-group' });
      const entry: [string, string[]] = [
        '1717000000002-0',
        [
          'eventId', 'uuid-upd',
          'eventType', 'rule.updated',
          'ruleId', updated.id,
          'emittedAt', new Date().toISOString(),
          'rule', JSON.stringify({
            id: updated.id,
            name: 'updated-rule',
            modelName: updated.modelName,
            groupCode: updated.groupCode,
            mode: updated.mode,
            domainExpression: updated.domainExpression,
            isActive: updated.isActive,
          }),
        ],
      ];

      await consumer.processBatch([entry]);

      const active = await source.loadAllActive();
      expect(active).toHaveLength(1);
      expect(active[0].groupCode).toBe('new-group');
      expect(resolver.refresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('rule.deleted event', () => {
    it('calls source.remove + resolver.refresh', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      const source = new StreamRecordRuleSource();
      jest.spyOn(source, 'remove');

      // Pre-populate source
      const rule = makeRule({ id: 'rule-to-delete' });
      source.upsert(rule);

      const consumer = makeConsumer(redis, resolver, makeMockLogger(), source) as any;
      await consumer.processBatch([makeDeletedEntry('rule-to-delete')]);

      expect(source.remove).toHaveBeenCalledWith('rule-to-delete');
      expect(resolver.refresh).toHaveBeenCalledTimes(1);

      const active = await source.loadAllActive();
      expect(active).toHaveLength(0);
    });
  });

  describe('missing rule payload', () => {
    it('logs warn and skips upsert when rule field is absent on created event', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      const source = new StreamRecordRuleSource();
      jest.spyOn(source, 'upsert');
      const logger = makeMockLogger();

      const consumer = makeConsumer(redis, resolver, logger, source) as any;

      // Entry without 'rule' field
      const entry: [string, string[]] = [
        '1717000000003-0',
        ['eventId', 'uuid-no-rule', 'eventType', 'rule.created', 'ruleId', 'r1',
         'emittedAt', new Date().toISOString()],
      ];

      await consumer.processBatch([entry]);

      expect(source.upsert).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('missing rule payload'),
        expect.objectContaining({ eventType: 'rule.created', ruleId: 'r1' }),
      );
      // resolver.refresh still called, xack still called
      expect(resolver.refresh).toHaveBeenCalledTimes(1);
      expect(redis.xack).toHaveBeenCalledTimes(1);
    });

    it('logs warn and skips when rule JSON is malformed', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      const source = new StreamRecordRuleSource();
      jest.spyOn(source, 'upsert');
      const logger = makeMockLogger();

      const consumer = makeConsumer(redis, resolver, logger, source) as any;

      const entry: [string, string[]] = [
        '1717000000004-0',
        ['eventId', 'uuid-bad', 'eventType', 'rule.updated', 'ruleId', 'r1',
         'emittedAt', new Date().toISOString(), 'rule', '{not valid json'],
      ];

      await consumer.processBatch([entry]);

      expect(source.upsert).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('JSON parse failed'),
        expect.objectContaining({ eventType: 'rule.updated', ruleId: 'r1' }),
      );
    });
  });

  describe('batch with mixed event types', () => {
    it('processes created + deleted in a single batch', async () => {
      const redis = makeMockRedis();
      const resolver = makeMockResolver();
      const source = new StreamRecordRuleSource();

      const consumer = makeConsumer(redis, resolver, makeMockLogger(), source) as any;

      const rule = makeRule({ id: 'r1' });
      await consumer.processBatch([
        makeCreatedEntry(rule, '1717-1'),
        makeDeletedEntry('r1', '1717-2'),
      ]);

      // Upserted then removed
      const active = await source.loadAllActive();
      expect(active).toHaveLength(0);

      // Single refresh after both mutations
      expect(resolver.refresh).toHaveBeenCalledTimes(1);
      expect(redis.xack).toHaveBeenCalledWith(
        'stream:record-rules-updated',
        'order-service-rbac-cg',
        '1717-1',
        '1717-2',
      );
    });
  });
});

describe('RecordRulesEventsConsumer — backward-compat without StreamRecordRuleSource', () => {
  afterEach(() => jest.clearAllMocks());

  it('calls only resolver.refresh — no source interaction (user-service mode)', async () => {
    const redis = makeMockRedis();
    const resolver = makeMockResolver();
    // No streamSource passed

    const consumer = makeConsumer(redis, resolver, makeMockLogger()) as any;

    const entries: Array<[string, string[]]> = [
      ['1717000000000-0', ['eventId', 'uuid-1', 'eventType', 'rule.created', 'ruleId', 'r1',
       'emittedAt', new Date().toISOString()]],
    ];

    await consumer.processBatch(entries);

    expect(resolver.refresh).toHaveBeenCalledTimes(1);
    expect(redis.xack).toHaveBeenCalledTimes(1);
  });
});
