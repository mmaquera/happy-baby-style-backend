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
  decryptMfaSecret: jest.fn().mockReturnValue('PLAINTEXT_SECRET_FOR_SETUP'),
  TOKEN_TYPES: { REFRESH: 'refresh', MFA_CHALLENGE: 'mfa_challenge' },
}), { virtual: true });

jest.mock('otplib', () => ({
  verifySync: jest.fn().mockReturnValue({ valid: true, delta: 0 }),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$bcrypt$hashed'),
  compare: jest.fn().mockResolvedValue(true),
}));

import { VerifyMfaSetupUseCase } from '../VerifyMfaSetupUseCase';
import { LoggerFactory } from '@hbs/logging';
import { verifySync } from 'otplib';

const mockVerifySync = verifySync as jest.Mock;

function makeLogger() {
  return LoggerFactory.getInstance().createUseCaseLogger('test') as any;
}

function makeMfaData(overrides: Partial<any> = {}) {
  return {
    mfaEnabled: false,
    mfaSecret: 'enc:stored:secret',
    mfaBackupCodes: [],
    ...overrides,
  };
}

function makeUserRepo(overrides: Partial<any> = {}): any {
  return {
    getMfaData: jest.fn().mockResolvedValue(makeMfaData()),
    enableMfa: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeSecurityEventRepo(): any {
  return {
    create: jest.fn().mockResolvedValue(undefined),
  };
}

describe('VerifyMfaSetupUseCase', () => {
  let useCase: VerifyMfaSetupUseCase;
  let userRepo: ReturnType<typeof makeUserRepo>;
  let securityEventRepo: ReturnType<typeof makeSecurityEventRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset attempt counters between tests
    userRepo = makeUserRepo();
    securityEventRepo = makeSecurityEventRepo();
    useCase = new VerifyMfaSetupUseCase(userRepo, securityEventRepo, makeLogger());
  });

  describe('Happy path', () => {
    it('enables MFA and returns backup codes when TOTP is valid', async () => {
      mockVerifySync.mockReturnValue({ valid: true });

      const result = await useCase.execute({ userId: 'user-1', code: '123456' });

      expect(result.mfaEnabled).toBe(true);
      expect(result.backupCodes).toHaveLength(8);
      result.backupCodes.forEach((code) => {
        expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      });
    });

    it('G-5: persists hashed codes (not plain text)', async () => {
      mockVerifySync.mockReturnValue({ valid: true });

      await useCase.execute({ userId: 'user-1', code: '123456' });

      const callArgs = userRepo.enableMfa.mock.calls[0];
      const persistedCodes: string[] = callArgs[1];
      persistedCodes.forEach((code) => {
        // Must be bcrypt hash, not plain backup code
        expect(code).toBe('$bcrypt$hashed');
      });
    });

    it('emits MFA_ENABLED security event', async () => {
      mockVerifySync.mockReturnValue({ valid: true });

      await useCase.execute({ userId: 'user-1', code: '123456' });

      expect(securityEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'mfa_enabled' }),
      );
    });
  });

  describe('Invalid TOTP code', () => {
    it('throws ValidationError when code is wrong', async () => {
      mockVerifySync.mockReturnValue({ valid: false });

      await expect(
        useCase.execute({ userId: 'user-new', code: 'wrong' }),
      ).rejects.toMatchObject({ message: expect.stringContaining('Invalid verification code') });
    });

    it('Bug #2: counter is cleared on failure so a new enableMFA gives a fresh attempt window', async () => {
      mockVerifySync.mockReturnValue({ valid: false });

      // First attempt fails — counter is set then cleared
      await expect(
        useCase.execute({ userId: 'retry-user', code: 'bad1' }),
      ).rejects.toMatchObject({ message: expect.stringContaining('Invalid verification code') });

      // Second attempt also fails — still within the 3-attempt window (not locked out)
      await expect(
        useCase.execute({ userId: 'retry-user', code: 'bad2' }),
      ).rejects.toMatchObject({ message: expect.stringContaining('Invalid verification code') });

      // Third attempt succeeds — counter was cleared on each failure so we never hit MAX_SETUP_ATTEMPTS
      mockVerifySync.mockReturnValue({ valid: true });
      const result = await useCase.execute({ userId: 'retry-user', code: 'good' });

      expect(result.mfaEnabled).toBe(true);
    });
  });

  describe('Error conditions', () => {
    it('throws NotFoundError if user has no MFA data', async () => {
      userRepo.getMfaData.mockResolvedValue(null);

      await expect(
        useCase.execute({ userId: 'ghost-user', code: '123456' }),
      ).rejects.toMatchObject({ message: expect.stringContaining('User') });
    });

    it('throws BusinessLogicError if MFA already enabled', async () => {
      userRepo.getMfaData.mockResolvedValue(makeMfaData({ mfaEnabled: true }));

      await expect(
        useCase.execute({ userId: 'enabled-user', code: '123456' }),
      ).rejects.toMatchObject({ message: expect.stringContaining('already enabled') });
    });

    it('throws ValidationError if mfaSecret is missing (setup not initiated)', async () => {
      userRepo.getMfaData.mockResolvedValue(makeMfaData({ mfaSecret: null }));

      await expect(
        useCase.execute({ userId: 'no-secret-user', code: '123456' }),
      ).rejects.toMatchObject({ message: expect.stringContaining('Call enableMFA first') });
    });
  });
});
