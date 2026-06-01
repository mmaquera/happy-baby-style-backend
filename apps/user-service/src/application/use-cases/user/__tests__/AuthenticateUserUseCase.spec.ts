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
}), { virtual: true });

import { AuthenticateUserUseCase } from '../AuthenticateUserUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { IAuthRepository } from '../../../../domain/repositories/IAuthRepository';
import type { ILogger } from '@hbs/logging';
import type { IEffectivePermissionsResolver } from '../../../../domain/interfaces/IEffectivePermissionsResolver';
import type { EffectiveAuthz } from '../../../../domain/interfaces/IEffectiveAuthz';
import { NotFoundError, UnauthorizedError } from '../../../../domain/errors/DomainError';

// bcrypt and jwt are real — we only need to mock their outputs
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

const makeUser = () => ({
  id: 'user-42',
  email: 'user@test.com',
  role: 'customer' as any,
  isActive: true,
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  firstName: 'Test',
  lastName: 'User',
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

const makeUserRepo = (): jest.Mocked<IUserRepository> =>
  ({
    getUserByEmail: jest.fn().mockResolvedValue(makeUser()),
    getUserPasswordHash: jest.fn().mockResolvedValue('hashed-password'),
    updateUserLastLogin: jest.fn().mockResolvedValue(undefined),
  } as any);

const makeAuthRepo = (): jest.Mocked<IAuthRepository> =>
  ({
    createSession: jest.fn().mockResolvedValue(makeSession()),
    createSessionAnalytics: jest.fn().mockResolvedValue({}),
  } as any);

const makeLogger = (): jest.Mocked<ILogger> =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
  (bcrypt.compare as jest.Mock).mockResolvedValue(true);
});

describe('AuthenticateUserUseCase', () => {
  describe('happy path — user with RBAC groups', () => {
    it('signs access token with groups and permissions from resolver', async () => {
      const resolver = makeResolver(withRbacGroups);
      const uc = new AuthenticateUserUseCase(
        makeUserRepo(),
        makeAuthRepo(),
        makeLogger(),
        resolver,
      );

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
  });

  describe('fallback path — user without RBAC groups (pre-backfill)', () => {
    it('uses legacy role-based permissions and logs a warning', async () => {
      const resolver = makeResolver(withoutGroups);
      const logger = makeLogger();
      const uc = new AuthenticateUserUseCase(
        makeUserRepo(),
        makeAuthRepo(),
        logger,
        resolver,
      );

      const jwt = require('jsonwebtoken');
      await uc.execute(validRequest());

      // groups should be empty array in the token
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          groups: [],
        }),
        expect.any(String),
        expect.any(Object),
      );

      // warn should have been called about the fallback
      expect(logger.warn).toHaveBeenCalledWith(
        'User has no RBAC groups, using legacy role-based permissions',
        expect.objectContaining({ userId: 'user-42', role: 'customer' }),
      );
    });
  });

  describe('error cases', () => {
    it('throws NotFoundError when user does not exist', async () => {
      const userRepo = makeUserRepo();
      userRepo.getUserByEmail.mockResolvedValue(null);

      const uc = new AuthenticateUserUseCase(
        userRepo,
        makeAuthRepo(),
        makeLogger(),
        makeResolver(withRbacGroups),
      );

      await expect(uc.execute(validRequest())).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws UnauthorizedError when user is inactive', async () => {
      const userRepo = makeUserRepo();
      userRepo.getUserByEmail.mockResolvedValue({ ...makeUser(), isActive: false });

      const uc = new AuthenticateUserUseCase(
        userRepo,
        makeAuthRepo(),
        makeLogger(),
        makeResolver(withRbacGroups),
      );

      await expect(uc.execute(validRequest())).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws UnauthorizedError when password is invalid', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const uc = new AuthenticateUserUseCase(
        makeUserRepo(),
        makeAuthRepo(),
        makeLogger(),
        makeResolver(withRbacGroups),
      );

      await expect(uc.execute(validRequest())).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('propagates resolver failure as thrown error', async () => {
      const resolver: jest.Mocked<IEffectivePermissionsResolver> = {
        resolveForUser: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      };

      const uc = new AuthenticateUserUseCase(
        makeUserRepo(),
        makeAuthRepo(),
        makeLogger(),
        resolver,
      );

      await expect(uc.execute(validRequest())).rejects.toThrow('DB connection lost');
    });
  });
});
