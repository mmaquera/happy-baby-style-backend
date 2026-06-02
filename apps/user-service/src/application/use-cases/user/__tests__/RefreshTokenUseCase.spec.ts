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
    },
    LoggingDecorator: {
      logUseCase: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
        descriptor,
    },
  }),
  { virtual: true },
);

jest.mock('@hbs/auth', () => ({}), { virtual: true });

import { RefreshTokenUseCase } from '../RefreshTokenUseCase';
import type { IAuthRepository } from '../../../../domain/repositories/IAuthRepository';
import type { ILogger } from '@hbs/logging';
import type { IEffectivePermissionsResolver } from '../../../../domain/interfaces/IEffectivePermissionsResolver';
import type { EffectiveAuthz } from '../../../../domain/interfaces/IEffectiveAuthz';
import { ValidationError } from '../../../../domain/errors/DomainError';

// Build a minimal valid JWT refresh token with a known userId payload
// (base64url-encoded, no real signature needed for unit tests that mock the repo)
const buildFakeRefreshToken = (userId: string): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId, email: 'u@test.com', type: 'refresh' })).toString('base64url');
  const sig = 'fakesig';
  return `${header}.${payload}.${sig}`;
};

const FAKE_TOKEN = buildFakeRefreshToken('user-42');

const makeUser = () => ({
  id: 'user-42',
  email: 'u@test.com',
  isActive: true,
});

const makeAuthResult = () => ({
  user: makeUser(),
  tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' },
  isNewUser: false,
  provider: 'email',
});

const makeAuthRepo = (): jest.Mocked<IAuthRepository> =>
  ({
    refreshUserSession: jest.fn().mockResolvedValue(makeAuthResult()),
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
  permissionCodes: ['read:product', 'create:order'],
};

const withoutGroups: EffectiveAuthz = {
  groupCodes: [],
  permissionCodes: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RefreshTokenUseCase', () => {
  describe('happy path — user with RBAC groups', () => {
    it('resolves effective permissions and passes them to the repository', async () => {
      const authRepo = makeAuthRepo();
      const resolver = makeResolver(withRbacGroups);

      const uc = new RefreshTokenUseCase(authRepo, makeLogger(), resolver);
      await uc.execute({ refreshToken: FAKE_TOKEN });

      expect(resolver.resolveForUser).toHaveBeenCalledWith('user-42');
      expect(authRepo.refreshUserSession).toHaveBeenCalledWith(
        FAKE_TOKEN,
        withRbacGroups,
      );
    });

    it('returns the user and new tokens from the repository', async () => {
      const uc = new RefreshTokenUseCase(makeAuthRepo(), makeLogger(), makeResolver(withRbacGroups));
      const result = await uc.execute({ refreshToken: FAKE_TOKEN });

      expect(result.tokens.accessToken).toBe('new-access');
      expect(result.tokens.refreshToken).toBe('new-refresh');
      expect(result.user.id).toBe('user-42');
    });
  });

  describe('user with empty RBAC groups', () => {
    it('passes empty effective to repo (no legacy fallback)', async () => {
      const authRepo = makeAuthRepo();
      const resolver = makeResolver(withoutGroups);

      const uc = new RefreshTokenUseCase(authRepo, makeLogger(), resolver);
      await uc.execute({ refreshToken: FAKE_TOKEN });

      expect(authRepo.refreshUserSession).toHaveBeenCalledWith(
        FAKE_TOKEN,
        withoutGroups,
      );
    });
  });

  describe('validation errors', () => {
    it('throws ValidationError when refreshToken is empty', async () => {
      const uc = new RefreshTokenUseCase(makeAuthRepo(), makeLogger(), makeResolver(withRbacGroups));
      await expect(uc.execute({ refreshToken: '' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when refreshToken is too short', async () => {
      const uc = new RefreshTokenUseCase(makeAuthRepo(), makeLogger(), makeResolver(withRbacGroups));
      await expect(uc.execute({ refreshToken: 'short' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws when repository throws', async () => {
      const authRepo = makeAuthRepo();
      authRepo.refreshUserSession.mockRejectedValue(new Error('Session not found'));

      const uc = new RefreshTokenUseCase(authRepo, makeLogger(), makeResolver(withRbacGroups));
      await expect(uc.execute({ refreshToken: FAKE_TOKEN })).rejects.toThrow('Session not found');
    });
  });
});
