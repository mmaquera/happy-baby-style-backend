/**
 * Unit tests for fetchSnapshotAndPopulate.
 *
 * Testing strategy:
 *   - Mock global fetch so no real HTTP calls are made.
 *   - Mock timers to collapse exponential backoff waits.
 *   - Verify source.upsert() call count and return value on success, HTTP error, network error, and AbortError.
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

import { fetchSnapshotAndPopulate } from '../snapshot-fetcher';
import { StreamRecordRuleSource } from '../stream-record-rule-source';
import type { RecordRule } from '../record-rule-resolver';
import type { ILogger } from '@hbs/logging';

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

function makeLogger(): ILogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as ILogger;
}

// ---------------------------------------------------------------------------
// fetch mock helpers
// Jest cannot spy on globalThis.fetch with the standard overload — assign directly.
// ---------------------------------------------------------------------------

function mockFetchSuccess(rules: RecordRule[]): jest.Mock {
  const mock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ rules }),
  } as unknown as Response);
  global.fetch = mock;
  return mock;
}

function mockFetchHttpError(status: number, statusText: string): jest.Mock {
  const mock = jest.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
  } as unknown as Response);
  global.fetch = mock;
  return mock;
}

function mockFetchNetworkError(message: string): jest.Mock {
  const mock = jest.fn().mockRejectedValue(new Error(message));
  global.fetch = mock;
  return mock;
}

function mockFetchAbortError(): jest.Mock {
  const err = new DOMException('The operation was aborted.', 'AbortError');
  const mock = jest.fn().mockRejectedValue(err);
  global.fetch = mock;
  return mock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchSnapshotAndPopulate', () => {
  // Use fake timers so the exponential backoff sleeps are instant.
  // Save / restore global.fetch manually since we assign it directly.
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  // --------------------------------------------------------------------------
  // Helper to drain pending promises + advance timers
  // --------------------------------------------------------------------------
  async function drainTimers(advanceMs = 10_000): Promise<void> {
    // Let the event loop flush pending microtasks, then advance fake timers.
    await Promise.resolve();
    jest.advanceTimersByTime(advanceMs);
    await Promise.resolve();
  }

  // --------------------------------------------------------------------------
  // Success path
  // --------------------------------------------------------------------------

  describe('success — HTTP 200 with rules', () => {
    it('calls source.upsert for each rule and returns {success:true, rulesLoaded:N}', async () => {
      const rules = [makeRule({ id: 'r1' }), makeRule({ id: 'r2' }), makeRule({ id: 'r3' })];
      mockFetchSuccess(rules);

      const source = new StreamRecordRuleSource();
      const upsertSpy = jest.spyOn(source, 'upsert');
      const logger = makeLogger();

      const resultPromise = fetchSnapshotAndPopulate(source, logger, {
        userServiceUrl: 'http://user-service:3006',
        maxRetries: 3,
      });

      await drainTimers();
      const result = await resultPromise;

      expect(result).toEqual({ success: true, rulesLoaded: 3 });
      expect(upsertSpy).toHaveBeenCalledTimes(3);
      expect(upsertSpy).toHaveBeenCalledWith(rules[0]);
      expect(upsertSpy).toHaveBeenCalledWith(rules[1]);
      expect(upsertSpy).toHaveBeenCalledWith(rules[2]);
      expect(logger.info).toHaveBeenCalledTimes(1);
    });

    it('returns {success:true, rulesLoaded:0} when endpoint returns empty rules array', async () => {
      mockFetchSuccess([]);

      const source = new StreamRecordRuleSource();
      const upsertSpy = jest.spyOn(source, 'upsert');
      const logger = makeLogger();

      const resultPromise = fetchSnapshotAndPopulate(source, logger, {
        userServiceUrl: 'http://user-service:3006',
      });

      await drainTimers();
      const result = await resultPromise;

      expect(result).toEqual({ success: true, rulesLoaded: 0 });
      expect(upsertSpy).not.toHaveBeenCalled();
    });

    it('uses the correct URL including /internal/record-rules path', async () => {
      const fetchSpy = mockFetchSuccess([]);
      const source = new StreamRecordRuleSource();
      const logger = makeLogger();

      const resultPromise = fetchSnapshotAndPopulate(source, logger, {
        userServiceUrl: 'http://user-service:3006',
      });

      await drainTimers();
      await resultPromise;

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://user-service:3006/internal/record-rules',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // HTTP error path (4xx / 5xx)
  // --------------------------------------------------------------------------

  describe('HTTP error (500)', () => {
    it('retries maxRetries times then returns {success:false, rulesLoaded:0}', async () => {
      const fetchSpy = mockFetchHttpError(500, 'Internal Server Error');
      const source = new StreamRecordRuleSource();
      const upsertSpy = jest.spyOn(source, 'upsert');
      const logger = makeLogger();

      const resultPromise = fetchSnapshotAndPopulate(source, logger, {
        userServiceUrl: 'http://user-service:3006',
        maxRetries: 3,
        timeoutMs: 5000,
      });

      // Drain each backoff interval: 1s, 2s, 3s
      await drainTimers(1000);
      await drainTimers(2000);
      await drainTimers(3000);

      const result = await resultPromise;

      expect(result).toEqual({ success: false, rulesLoaded: 0 });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(3);
    });

    it('succeeds on the second attempt when first attempt returns 500', async () => {
      const rules = [makeRule({ id: 'r1' })];
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: false, status: 500, statusText: 'Internal Server Error' } as unknown as Response;
        }
        return { ok: true, json: async () => ({ rules }) } as unknown as Response;
      });

      const source = new StreamRecordRuleSource();
      const upsertSpy = jest.spyOn(source, 'upsert');
      const logger = makeLogger();

      const resultPromise = fetchSnapshotAndPopulate(source, logger, {
        userServiceUrl: 'http://user-service:3006',
        maxRetries: 3,
      });

      await drainTimers(1000);
      await drainTimers(500);

      const result = await resultPromise;

      expect(result).toEqual({ success: true, rulesLoaded: 1 });
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1); // only 1st attempt warned
    });
  });

  // --------------------------------------------------------------------------
  // Network error path (fetch throws)
  // --------------------------------------------------------------------------

  describe('network error (fetch throws)', () => {
    it('retries maxRetries times then returns {success:false, rulesLoaded:0}', async () => {
      const fetchSpy = mockFetchNetworkError('ECONNREFUSED');
      const source = new StreamRecordRuleSource();
      const logger = makeLogger();

      const resultPromise = fetchSnapshotAndPopulate(source, logger, {
        userServiceUrl: 'http://user-service:3006',
        maxRetries: 3,
        timeoutMs: 5000,
      });

      await drainTimers(1000);
      await drainTimers(2000);
      await drainTimers(3000);

      const result = await resultPromise;

      expect(result).toEqual({ success: false, rulesLoaded: 0 });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // Timeout / AbortError path
  // --------------------------------------------------------------------------

  describe('timeout (AbortError)', () => {
    it('retries after AbortError and eventually returns {success:false, rulesLoaded:0}', async () => {
      const fetchSpy = mockFetchAbortError();
      const source = new StreamRecordRuleSource();
      const logger = makeLogger();

      const resultPromise = fetchSnapshotAndPopulate(source, logger, {
        userServiceUrl: 'http://user-service:3006',
        maxRetries: 3,
        timeoutMs: 100,
      });

      await drainTimers(1000);
      await drainTimers(2000);
      await drainTimers(3000);

      const result = await resultPromise;

      expect(result).toEqual({ success: false, rulesLoaded: 0 });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('warn messages include attempt number and url', async () => {
      mockFetchAbortError();
      const source = new StreamRecordRuleSource();
      const logger = makeLogger();

      const resultPromise = fetchSnapshotAndPopulate(source, logger, {
        userServiceUrl: 'http://user-service:3006',
        maxRetries: 2,
        timeoutMs: 100,
      });

      await drainTimers(1000);
      await drainTimers(2000);

      await resultPromise;

      const warnCalls = (logger.warn as jest.Mock).mock.calls;
      expect(warnCalls[0][1]).toMatchObject({ attempt: 1, maxRetries: 2 });
      expect(warnCalls[1][1]).toMatchObject({ attempt: 2, maxRetries: 2 });
    });
  });

  // --------------------------------------------------------------------------
  // maxRetries=1 edge case
  // --------------------------------------------------------------------------

  describe('maxRetries=1', () => {
    it('does not retry — fails immediately on first error', async () => {
      const fetchSpy = mockFetchNetworkError('ECONNREFUSED');
      const source = new StreamRecordRuleSource();
      const logger = makeLogger();

      const result = await fetchSnapshotAndPopulate(source, logger, {
        userServiceUrl: 'http://user-service:3006',
        maxRetries: 1,
      });

      expect(result).toEqual({ success: false, rulesLoaded: 0 });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });
});
