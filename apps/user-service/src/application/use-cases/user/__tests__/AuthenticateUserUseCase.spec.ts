jest.mock(
  '@hbs/logging',
  () => ({
    LoggerFactory: {
      getInstance: () => ({
        createUseCaseLogger: () => ({
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        }),
      }),
      create: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    },
  }),
  { virtual: true },
);

jest.mock('@hbs/auth', () => ({
  resolvePermissions: jest.fn().mockReturnValue(['read:product', 'create:order', 'read:order', 'read:user']),
  TOKEN_TYPES: {
    REFRESH: 'refresh',
    MFA_CHALLENGE: 'mfa_challenge',
    PASSWORD_RESET: 'password_reset',
    EMAIL_VERIFICATION: 'email_verification',
  },
}), { virtual: true });

import { AuthenticateUserUseCase } from '../AuthenticateUserUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { IAuthRepository } from '../../../../domain/repositories/IAuthRepository';
import type { ISecurityEventRepository } from '../../../../domain/repositories/ISecurityEventRepository';
import type { ILogger } from '@hbs/logging';
import type { IEffectivePermissionsResolver } from '../../../../domain/interfaces/IEffectivePermissionsResolver';
import type { IGeoIpPort } from '../../../../domain/ports/IGeoIpPort';
import type { EffectiveAuthz } from '../../../../domain/interfaces/IEffectiveAuthz';
import { UnauthorizedError } from '../../../../domain/errors/DomainError';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('signed-access-token'),
}));
jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-uuid'),
}));

import bcrypt from 'bcryptjs';

// ── Factory helpers ──────────────────────────────────────────────────────────

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-42',
  email: 'user@test.com',
  role: 'customer' as any,
  isActive: true,
  emailVerified: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeSession = () => ({
  id: 'session-1',
  sessionToken: 'mock-uuid',
  accessToken: 'signed-access-token',
  refreshToken: 'refresh-token',
  userId: 'user-42',
  expiresAt: new Date(Date.now() + 86400000),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  userAgent: undefined,
  ipAddress: undefined,
});

const makeUserRepo = (overrides: Partial<jest.Mocked<IUserRepository>> = {}): jest.Mocked<IUserRepository> =>
  ({
    getUserByEmail: jest.fn().mockResolvedValue(makeUser()),
    getUserPasswordHash: jest.fn().mockResolvedValue('hashed-password'),
    updateUserLastLogin: jest.fn().mockResolvedValue(undefined),
    updateUserLockout: jest.fn().mockResolvedValue(undefined),
    resetUserLockout: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any);

const makeAuthRepo = (): jest.Mocked<IAuthRepository> =>
  ({
    createSession: jest.fn().mockResolvedValue(makeSession()),
    createSessionAnalytics: jest.fn().mockResolvedValue({}),
  } as any);

const makeSecurityEventRepo = (): jest.Mocked<ISecurityEventRepository> =>
  ({
    create: jest.fn().mockResolvedValue({}),
  } as any);

const makeLogger = (): jest.Mocked<ILogger> =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as any);

const makeGeoIpPort = (result = {}): jest.Mocked<IGeoIpPort> =>
  ({
    lookup: jest.fn().mockReturnValue(result),
  } as any);

const makeResolver = (effective: EffectiveAuthz): jest.Mocked<IEffectivePermissionsResolver> =>
  ({
    resolveForUser: jest.fn().mockResolvedValue(effective),
  } as any);

const withRbacGroups: EffectiveAuthz = {
  groupCodes: ['customer'],
  permissionCodes: ['read:product', 'create:order', 'read:order', 'read:user'],
};

const withoutGroups: EffectiveAuthz = {
  groupCodes: [],
  permissionCodes: [],
};

const validRequest = () => ({
  email: 'user@test.com',
  password: 'SecurePass1!',
  userAgent: 'jest/test',
  ipAddress: '127.0.0.1',
});

function makeUseCase(
  userRepo: jest.Mocked<IUserRepository> = makeUserRepo(),
  authRepo: jest.Mocked<IAuthRepository> = makeAuthRepo(),
  logger: jest.Mocked<ILogger> = makeLogger(),
  resolver: jest.Mocked<IEffectivePermissionsResolver> = makeResolver(withRbacGroups),
  secRepo: jest.Mocked<ISecurityEventRepository> = makeSecurityEventRepo(),
  geoIp: jest.Mocked<IGeoIpPort> = makeGeoIpPort(),
) {
  return new AuthenticateUserUseCase(userRepo, authRepo, logger, resolver, secRepo, geoIp);
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
  process.env.MAX_LOGIN_ATTEMPTS = '5';
  process.env.LOCKOUT_DURATION = '900';
  (bcrypt.compare as jest.Mock).mockResolvedValue(true);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuthenticateUserUseCase', () => {
  describe('happy path — user with RBAC groups', () => {
    it('signs access token with groups and permissions from resolver', async () => {
      const resolver = makeResolver(withRbacGroups);
      const uc = makeUseCase(undefined, undefined, undefined, resolver);
      const jwt = require('jsonwebtoken');

      const result = await uc.execute(validRequest());

      expect(result.accessToken).toBe('signed-access-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-42',
          groups: ['customer'],
          permissions: ['read:product', 'create:order', 'read:order', 'read:user'],
        }),
        'test-secret',
        { expiresIn: '1h' },
      );
      expect(resolver.resolveForUser).toHaveBeenCalledWith('user-42');
    });

    it('resets lockout counters on success', async () => {
      const userRepo = makeUserRepo();
      const uc = makeUseCase(userRepo);

      await uc.execute(validRequest());

      expect(userRepo.resetUserLockout).toHaveBeenCalledWith('user-42');
    });

    it('emits LOGIN_SUCCESS security event on success', async () => {
      const secRepo = makeSecurityEventRepo();
      const uc = makeUseCase(undefined, undefined, undefined, undefined, secRepo);

      await uc.execute(validRequest());

      expect(secRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'login_success' }),
      );
    });
  });

  describe('fallback path — user without RBAC groups (pre-backfill)', () => {
    it('uses legacy role-based permissions and logs a warning', async () => {
      const resolver = makeResolver(withoutGroups);
      const logger = makeLogger();
      const uc = makeUseCase(undefined, undefined, logger, resolver);
      const jwt = require('jsonwebtoken');

      await uc.execute(validRequest());

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ groups: [] }),
        expect.any(String),
        expect.any(Object),
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'User has no RBAC groups, using legacy role-based permissions',
        expect.objectContaining({ userId: 'user-42', role: 'customer' }),
      );
    });
  });

  describe('user not found — generic message, LOGIN_FAILED event', () => {
    it('throws UnauthorizedError with generic message when user not found', async () => {
      const userRepo = makeUserRepo({ getUserByEmail: jest.fn().mockResolvedValue(null) });
      const secRepo = makeSecurityEventRepo();
      const uc = makeUseCase(userRepo, undefined, undefined, undefined, secRepo);

      const err = await uc.execute(validRequest()).catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err.message).toBe('Invalid email or password');
    });

    it('emits LOGIN_FAILED (without userId) when user not found', async () => {
      const userRepo = makeUserRepo({ getUserByEmail: jest.fn().mockResolvedValue(null) });
      const secRepo = makeSecurityEventRepo();
      const uc = makeUseCase(userRepo, undefined, undefined, undefined, secRepo);

      await uc.execute(validRequest()).catch(() => {});

      expect(secRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'login_failed',
          userId: undefined,
          metadata: expect.objectContaining({ reason: 'user_not_found' }),
        }),
      );
    });
  });

  describe('account lockout — generic message, no information leak', () => {
    it('throws generic UnauthorizedError when account is locked (not expired)', async () => {
      const futureDate = new Date(Date.now() + 60 * 1000);
      const userRepo = makeUserRepo({
        getUserByEmail: jest.fn().mockResolvedValue(
          makeUser({ lockedUntil: futureDate, failedLoginAttempts: 5 }),
        ),
      });
      const uc = makeUseCase(userRepo);

      const err = await uc.execute(validRequest()).catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err.message).toBe('Invalid email or password');
    });

    it('emits LOGIN_FAILED (not ACCOUNT_LOCKED) when blocked by lockout', async () => {
      const futureDate = new Date(Date.now() + 60 * 1000);
      const userRepo = makeUserRepo({
        getUserByEmail: jest.fn().mockResolvedValue(
          makeUser({ lockedUntil: futureDate, failedLoginAttempts: 5 }),
        ),
      });
      const secRepo = makeSecurityEventRepo();
      const uc = makeUseCase(userRepo, undefined, undefined, undefined, secRepo);

      await uc.execute(validRequest()).catch(() => {});

      const calls = (secRepo.create as jest.Mock).mock.calls.map((c) => c[0].eventType);
      expect(calls).toContain('login_failed');
      expect(calls).not.toContain('account_locked');
    });

    it('allows login when lockedUntil is in the past (expired lock)', async () => {
      const pastDate = new Date(Date.now() - 1000);
      const userRepo = makeUserRepo({
        getUserByEmail: jest.fn().mockResolvedValue(
          makeUser({ lockedUntil: pastDate, failedLoginAttempts: 5 }),
        ),
      });
      const uc = makeUseCase(userRepo);

      const result = await uc.execute(validRequest());
      expect(result.accessToken).toBe('signed-access-token');
    });
  });

  describe('inactive account — generic message', () => {
    it('throws generic UnauthorizedError when user is inactive', async () => {
      const userRepo = makeUserRepo({
        getUserByEmail: jest.fn().mockResolvedValue(makeUser({ isActive: false })),
      });
      const uc = makeUseCase(userRepo);

      const err = await uc.execute(validRequest()).catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err.message).toBe('Invalid email or password');
    });
  });

  describe('invalid password — increments attempt counter', () => {
    beforeEach(() => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    });

    it('throws generic UnauthorizedError on wrong password', async () => {
      const uc = makeUseCase();
      const err = await uc.execute(validRequest()).catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err.message).toBe('Invalid email or password');
    });

    it('increments failedLoginAttempts without locking when below threshold', async () => {
      const userRepo = makeUserRepo({
        getUserByEmail: jest.fn().mockResolvedValue(makeUser({ failedLoginAttempts: 2 })),
      });
      const uc = makeUseCase(userRepo);

      await uc.execute(validRequest()).catch(() => {});

      expect(userRepo.updateUserLockout).toHaveBeenCalledWith('user-42', {
        failedLoginAttempts: 3,
        lockedUntil: null,
      });
    });

    it('sets lockedUntil when attempt count reaches MAX_LOGIN_ATTEMPTS', async () => {
      process.env.MAX_LOGIN_ATTEMPTS = '5';
      const userRepo = makeUserRepo({
        getUserByEmail: jest.fn().mockResolvedValue(makeUser({ failedLoginAttempts: 4 })),
      });
      const uc = makeUseCase(userRepo);

      await uc.execute(validRequest()).catch(() => {});

      expect(userRepo.updateUserLockout).toHaveBeenCalledWith(
        'user-42',
        expect.objectContaining({
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
        }),
      );
    });

    it('emits both LOGIN_FAILED and ACCOUNT_LOCKED when threshold reached', async () => {
      process.env.MAX_LOGIN_ATTEMPTS = '5';
      const userRepo = makeUserRepo({
        getUserByEmail: jest.fn().mockResolvedValue(makeUser({ failedLoginAttempts: 4 })),
      });
      const secRepo = makeSecurityEventRepo();
      const uc = makeUseCase(userRepo, undefined, undefined, undefined, secRepo);

      await uc.execute(validRequest()).catch(() => {});

      const eventTypes = (secRepo.create as jest.Mock).mock.calls.map((c) => c[0].eventType);
      expect(eventTypes).toContain('login_failed');
      expect(eventTypes).toContain('account_locked');
    });

    it('emits LOGIN_FAILED with attemptCount metadata when below threshold', async () => {
      const userRepo = makeUserRepo({
        getUserByEmail: jest.fn().mockResolvedValue(makeUser({ failedLoginAttempts: 1 })),
      });
      const secRepo = makeSecurityEventRepo();
      const uc = makeUseCase(userRepo, undefined, undefined, undefined, secRepo);

      await uc.execute(validRequest()).catch(() => {});

      expect(secRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'login_failed',
          metadata: expect.objectContaining({ attemptCount: 2 }),
        }),
      );
    });
  });

  describe('GeoIp integration', () => {
    it('passes geo data to session analytics', async () => {
      const authRepo = makeAuthRepo();
      const geoIp = makeGeoIpPort({ country: 'CO', city: 'Bogotá' });
      const uc = makeUseCase(undefined, authRepo, undefined, undefined, undefined, geoIp);

      await uc.execute(validRequest());

      expect(authRepo.createSessionAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'CO', city: 'Bogotá' }),
      );
    });

    it('passes undefined geo fields when lookup returns empty', async () => {
      const authRepo = makeAuthRepo();
      const geoIp = makeGeoIpPort({});
      const uc = makeUseCase(undefined, authRepo, undefined, undefined, undefined, geoIp);

      await uc.execute(validRequest());

      expect(authRepo.createSessionAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({ country: undefined, city: undefined }),
      );
    });

    it('calls geoIp.lookup with the request ipAddress', async () => {
      const geoIp = makeGeoIpPort();
      const uc = makeUseCase(undefined, undefined, undefined, undefined, undefined, geoIp);

      await uc.execute({ ...validRequest(), ipAddress: '203.0.113.5' });

      expect(geoIp.lookup).toHaveBeenCalledWith('203.0.113.5');
    });

    it('does not fail auth when geoIp lookup returns empty (null ip)', async () => {
      const geoIp = makeGeoIpPort();
      const uc = makeUseCase(undefined, undefined, undefined, undefined, undefined, geoIp);

      const result = await uc.execute({ ...validRequest(), ipAddress: undefined });
      expect(result.accessToken).toBe('signed-access-token');
    });
  });

  describe('resolver failure propagation', () => {
    it('propagates resolver failure as thrown error', async () => {
      const resolver: jest.Mocked<IEffectivePermissionsResolver> = {
        resolveForUser: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      };
      const uc = makeUseCase(undefined, undefined, undefined, resolver);

      await expect(uc.execute(validRequest())).rejects.toThrow('DB connection lost');
    });
  });
});
