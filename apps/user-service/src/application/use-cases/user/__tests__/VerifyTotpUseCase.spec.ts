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

jest.mock('@hbs/auth', () => ({
  TOKEN_TYPES: {
    REFRESH: 'refresh',
    MFA_CHALLENGE: 'mfa_challenge',
    PASSWORD_RESET: 'password_reset',
    EMAIL_VERIFICATION: 'email_verification',
  },
  decryptMfaSecret: jest.fn().mockReturnValue('PLAIN_TOTP_SECRET'),
  resolvePermissions: jest.fn().mockReturnValue(['read:product']),
}), { virtual: true });

jest.mock('jsonwebtoken');
jest.mock('otplib', () => ({
  verifySync: jest.fn().mockReturnValue({ valid: true }),
}));
jest.mock('bcryptjs', () => ({
  compare: jest.fn().mockResolvedValue(false),
  hash: jest.fn().mockResolvedValue('$bcrypt$hash'),
}));

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';
import { VerifyTotpUseCase } from '../VerifyTotpUseCase';
import { LoggerFactory } from '@hbs/logging';

const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockVerifySync = verifySync as jest.Mock;
const mockBcryptCompare = bcrypt.compare as jest.Mock;

const CHALLENGE_ID = 'challenge-uuid-123';
const USER_ID = 'user-abc';
const VALID_CHALLENGE_TOKEN = 'valid.challenge.token';

function makeLogger() {
  return LoggerFactory.getInstance().createUseCaseLogger('test') as any;
}

function makeUserRepo(overrides: Partial<any> = {}): any {
  return {
    getUserById: jest.fn().mockResolvedValue({
      id: USER_ID,
      email: 'user@example.com',
      role: 'customer',
      isActive: true,
    }),
    getMfaData: jest.fn().mockResolvedValue({
      mfaEnabled: true,
      mfaSecret: 'enc:stored',
      mfaBackupCodes: ['$bcrypt$backup1', '$bcrypt$backup2'],
    }),
    enableMfa: jest.fn().mockResolvedValue(undefined),
    updateUserLastLogin: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeAuthRepo(): any {
  return {
    createSession: jest.fn().mockResolvedValue({ id: 'session-1', sessionToken: 'tok' }),
  };
}

function makeSecurityEventRepo(): any {
  return {
    create: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMfaChallengeStore(overrides: Partial<any> = {}): any {
  return {
    incrAttempts: jest.fn().mockResolvedValue(1),
    consume: jest.fn().mockResolvedValue(USER_ID),
    del: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeEffectivePermissionsResolver(): any {
  return {
    resolveForUser: jest.fn().mockResolvedValue({
      groupCodes: ['customer'],
      permissionCodes: ['read:product'],
    }),
  };
}

describe('VerifyTotpUseCase', () => {
  let useCase: VerifyTotpUseCase;
  let userRepo: ReturnType<typeof makeUserRepo>;
  let authRepo: ReturnType<typeof makeAuthRepo>;
  let securityEventRepo: ReturnType<typeof makeSecurityEventRepo>;
  let mfaChallengeStore: ReturnType<typeof makeMfaChallengeStore>;
  let effectivePermissionsResolver: ReturnType<typeof makeEffectivePermissionsResolver>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret';

    userRepo = makeUserRepo();
    authRepo = makeAuthRepo();
    securityEventRepo = makeSecurityEventRepo();
    mfaChallengeStore = makeMfaChallengeStore();
    effectivePermissionsResolver = makeEffectivePermissionsResolver();

    (mockJwt.verify as jest.Mock).mockReturnValue({
      userId: USER_ID,
      challengeId: CHALLENGE_ID,
      type: 'mfa_challenge',
    });
    (mockJwt.sign as jest.Mock).mockReturnValue('mock.access.token');
    mockVerifySync.mockReturnValue({ valid: true });

    useCase = new VerifyTotpUseCase(
      userRepo,
      authRepo,
      securityEventRepo,
      mfaChallengeStore,
      effectivePermissionsResolver,
      makeLogger(),
    );
  });

  describe('Happy path — TOTP', () => {
    it('issues access and refresh tokens on valid TOTP', async () => {
      const result = await useCase.execute({
        mfaChallengeToken: VALID_CHALLENGE_TOKEN,
        code: '123456',
      });

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshToken).toBe('mock.access.token');
      expect(result.user.id).toBe(USER_ID);
      expect(mfaChallengeStore.consume).toHaveBeenCalledWith(CHALLENGE_ID);
    });

    it('emits MFA_CHALLENGE_SUCCEEDED event', async () => {
      await useCase.execute({ mfaChallengeToken: VALID_CHALLENGE_TOKEN, code: '123456' });

      expect(securityEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'mfa_challenge_succeeded' }),
      );
    });
  });

  describe('Happy path — Backup code', () => {
    it('accepts valid backup code and removes it atomically (G-6)', async () => {
      mockBcryptCompare.mockResolvedValueOnce(true); // first code matches

      const result = await useCase.execute({
        mfaChallengeToken: VALID_CHALLENGE_TOKEN,
        code: 'ABCD-EFGH-IJKL', // matches backup code format
      });

      expect(result.accessToken).toBe('mock.access.token');
      // enableMfa is called with one code removed
      expect(userRepo.enableMfa).toHaveBeenCalledWith(
        USER_ID,
        expect.arrayContaining(['$bcrypt$backup2']), // backup1 removed
      );
    });

    it('G-6: emits LAST_BACKUP_CODE_USED when last code consumed', async () => {
      userRepo.getMfaData.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: 'enc:stored',
        mfaBackupCodes: ['$bcrypt$only-one'],
      });
      mockBcryptCompare.mockResolvedValueOnce(true);

      await useCase.execute({
        mfaChallengeToken: VALID_CHALLENGE_TOKEN,
        code: 'ABCD-EFGH-IJKL',
      });

      expect(securityEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'mfa_last_backup_code_used' }),
      );
    });

    it('Bug #4: backup code is NOT consumed when createSession fails', async () => {
      mockBcryptCompare.mockResolvedValueOnce(true);
      authRepo.createSession.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        useCase.execute({ mfaChallengeToken: VALID_CHALLENGE_TOKEN, code: 'ABCD-EFGH-IJKL' }),
      ).rejects.toThrow('DB connection lost');

      // enableMfa must NOT have been called — the code is not burned
      expect(userRepo.enableMfa).not.toHaveBeenCalled();
    });
  });

  describe('Bug #1: 3-attempt window preserved', () => {
    it('does NOT consume the challenge on the first wrong TOTP (attempt 1)', async () => {
      mockVerifySync.mockReturnValue({ valid: false });
      mfaChallengeStore.incrAttempts.mockResolvedValue(1); // first attempt

      await expect(
        useCase.execute({ mfaChallengeToken: VALID_CHALLENGE_TOKEN, code: '000000' }),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });

      // Challenge must NOT be consumed — user still has 2 more attempts
      expect(mfaChallengeStore.consume).not.toHaveBeenCalled();
    });

    it('does NOT consume the challenge on the second wrong TOTP (attempt 2)', async () => {
      mockVerifySync.mockReturnValue({ valid: false });
      mfaChallengeStore.incrAttempts.mockResolvedValue(2);

      await expect(
        useCase.execute({ mfaChallengeToken: VALID_CHALLENGE_TOKEN, code: '111111' }),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });

      expect(mfaChallengeStore.consume).not.toHaveBeenCalled();
    });

    it('consumes the challenge on the third correct TOTP (attempt 3)', async () => {
      mockVerifySync.mockReturnValue({ valid: true });
      mfaChallengeStore.incrAttempts.mockResolvedValue(3); // exactly at limit but still valid

      const result = await useCase.execute({
        mfaChallengeToken: VALID_CHALLENGE_TOKEN,
        code: '123456',
      });

      expect(result.accessToken).toBe('mock.access.token');
      expect(mfaChallengeStore.consume).toHaveBeenCalledWith(CHALLENGE_ID);
    });
  });

  describe('G-2: Token type validation', () => {
    it('throws UnauthorizedError if token type is wrong', async () => {
      (mockJwt.verify as jest.Mock).mockReturnValue({
        userId: USER_ID,
        challengeId: CHALLENGE_ID,
        type: 'refresh', // wrong
      });

      await expect(
        useCase.execute({ mfaChallengeToken: 'bad-token', code: '123456' }),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });
    });
  });

  describe('Expired / invalid challenge token', () => {
    it('throws UnauthorizedError on JWT verify failure', async () => {
      (mockJwt.verify as jest.Mock).mockImplementation(() => { throw new Error('expired'); });

      await expect(
        useCase.execute({ mfaChallengeToken: 'expired.token', code: '123456' }),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });
    });

    it('throws UnauthorizedError if challenge already consumed (Redis returns null)', async () => {
      mfaChallengeStore.consume.mockResolvedValue(null);

      await expect(
        useCase.execute({ mfaChallengeToken: VALID_CHALLENGE_TOKEN, code: '123456' }),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });
    });
  });

  describe('G-7: userId binding', () => {
    it('throws SUSPICIOUS_ACTIVITY when userId mismatch', async () => {
      mfaChallengeStore.consume.mockResolvedValue('different-user-id');

      await expect(
        useCase.execute({ mfaChallengeToken: VALID_CHALLENGE_TOKEN, code: '123456' }),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });

      expect(securityEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'suspicious_activity' }),
      );
    });
  });

  describe('Max attempts exceeded', () => {
    it('invalidates challenge and throws after 3 failed attempts (G-3 messaging)', async () => {
      mfaChallengeStore.incrAttempts.mockResolvedValue(4); // exceeds limit

      await expect(
        useCase.execute({ mfaChallengeToken: VALID_CHALLENGE_TOKEN, code: '000000' }),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });

      expect(mfaChallengeStore.del).toHaveBeenCalledWith(CHALLENGE_ID);
    });
  });

  describe('Invalid TOTP code', () => {
    it('throws UnauthorizedError on wrong TOTP', async () => {
      mockVerifySync.mockReturnValue({ valid: false });

      await expect(
        useCase.execute({ mfaChallengeToken: VALID_CHALLENGE_TOKEN, code: '999999' }),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });
    });
  });

  describe('Invalid backup code', () => {
    it('throws UnauthorizedError on wrong backup code', async () => {
      mockBcryptCompare.mockResolvedValue(false); // no match

      await expect(
        useCase.execute({ mfaChallengeToken: VALID_CHALLENGE_TOKEN, code: 'XXXX-YYYY-ZZZZ' }),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });
    });
  });
});
