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
  encryptMfaSecret: jest.fn().mockReturnValue('enc:secret:abc123'),
  decryptMfaSecret: jest.fn().mockReturnValue('PLAINTEXT_SECRET'),
  TOKEN_TYPES: { REFRESH: 'refresh', MFA_CHALLENGE: 'mfa_challenge' },
}), { virtual: true });

jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('TESTBASE32SECRET'),
  generateURI: jest.fn().mockReturnValue('otpauth://totp/App:user@example.com?secret=TESTBASE32SECRET'),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,abc123'),
}));

import { EnableMfaUseCase } from '../EnableMfaUseCase';
import { LoggerFactory } from '@hbs/logging';

function makeLogger() {
  return LoggerFactory.getInstance().createUseCaseLogger('test') as any;
}

function makeUserRepo(overrides: Partial<any> = {}): any {
  return {
    getUserById: jest.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com' }),
    getMfaData: jest.fn().mockResolvedValue({ mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] }),
    setMfaSecret: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('EnableMfaUseCase', () => {
  let useCase: EnableMfaUseCase;
  let userRepo: ReturnType<typeof makeUserRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MFA_ENC_KEY = 'a'.repeat(64);
    userRepo = makeUserRepo();
    useCase = new EnableMfaUseCase(userRepo, makeLogger());
  });

  describe('Happy path', () => {
    it('returns otpauthUrl, qrDataUrl, and secret', async () => {
      const result = await useCase.execute({ userId: 'user-1' });

      expect(result.otpauthUrl).toBe('otpauth://totp/App:user@example.com?secret=TESTBASE32SECRET');
      expect(result.qrDataUrl).toBe('data:image/png;base64,abc123');
      expect(result.secret).toBe('TESTBASE32SECRET');
    });

    it('G-4: encrypts secret before persisting', async () => {
      const { encryptMfaSecret } = require('@hbs/auth');
      await useCase.execute({ userId: 'user-1' });

      expect(encryptMfaSecret).toHaveBeenCalledWith('TESTBASE32SECRET');
      expect(userRepo.setMfaSecret).toHaveBeenCalledWith('user-1', 'enc:secret:abc123');
    });
  });

  describe('Errors', () => {
    it('throws NotFoundError if user not found', async () => {
      userRepo.getUserById.mockResolvedValue(null);

      await expect(useCase.execute({ userId: 'missing' })).rejects.toMatchObject({
        message: expect.stringContaining('User'),
      });
    });

    it('throws BusinessLogicError if MFA already enabled', async () => {
      userRepo.getMfaData.mockResolvedValue({ mfaEnabled: true, mfaSecret: 'enc:x', mfaBackupCodes: [] });

      await expect(useCase.execute({ userId: 'user-1' })).rejects.toMatchObject({
        message: expect.stringContaining('already enabled'),
      });
    });
  });
});
