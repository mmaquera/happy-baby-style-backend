import type Redis from 'ioredis';
import type { ILogger } from '@hbs/logging';
import type { IMfaChallengeStore } from '../../domain/ports/IMfaChallengeStore';

const KEY_PREFIX = 'mfa:challenge:';
const ATTEMPTS_SUFFIX = ':attempts';

/**
 * Redis-backed implementation of IMfaChallengeStore.
 *
 * Key layout:
 *   mfa:challenge:<challengeId>            → userId (string), TTL = 300s
 *   mfa:challenge:<challengeId>:attempts   → integer counter, TTL = 300s
 *
 * consume() uses a Lua script to atomically GET + DEL the challenge key,
 * preventing race conditions between concurrent TOTP verify attempts.
 */
export class RedisMfaChallengeStore implements IMfaChallengeStore {
  constructor(
    private readonly redis: Redis,
    private readonly logger: ILogger,
  ) {}

  private challengeKey(id: string): string {
    return `${KEY_PREFIX}${id}`;
  }

  private attemptsKey(id: string): string {
    return `${KEY_PREFIX}${id}${ATTEMPTS_SUFFIX}`;
  }

  async save(challengeId: string, userId: string, ttlSeconds: number): Promise<void> {
    const key = this.challengeKey(challengeId);
    await this.redis.set(key, userId, 'EX', ttlSeconds);
    this.logger.info('MFA challenge stored', { challengeId, ttlSeconds });
  }

  async consume(challengeId: string): Promise<string | null> {
    const key = this.challengeKey(challengeId);

    // Atomic GET + DEL via Lua script — prevents double-consume races
    const luaScript = `
      local val = redis.call('GET', KEYS[1])
      if val then
        redis.call('DEL', KEYS[1])
        redis.call('DEL', KEYS[2])
      end
      return val
    `;

    const result = await this.redis.eval(
      luaScript,
      2,
      key,
      this.attemptsKey(challengeId),
    ) as string | null;

    if (result) {
      this.logger.info('MFA challenge consumed', { challengeId });
    }

    return result ?? null;
  }

  async incrAttempts(challengeId: string): Promise<number> {
    const attKey = this.attemptsKey(challengeId);

    // Bug #5 fix: the previous INCR + EXPIRE was not atomic — if the process crashed
    // between the two commands the key would exist forever without a TTL, creating a
    // permanent lockout. The Lua script below makes both operations a single atomic unit:
    //   1. SET the key to 0 with NX + EX only on first call (initialise with TTL).
    //   2. INCR unconditionally returns the new value.
    // Because Lua scripts run atomically in Redis, there is no window for partial state.
    const luaScript = `
      redis.call('SET', KEYS[1], 0, 'NX', 'EX', ARGV[1])
      return redis.call('INCR', KEYS[1])
    `;

    const count = await this.redis.eval(luaScript, 1, attKey, '300') as number;
    return count;
  }

  async del(challengeId: string): Promise<void> {
    await this.redis.del(this.challengeKey(challengeId), this.attemptsKey(challengeId));
    this.logger.info('MFA challenge deleted (max attempts exceeded)', { challengeId });
  }
}
