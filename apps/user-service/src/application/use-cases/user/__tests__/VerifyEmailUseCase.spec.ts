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

jest.mock('jsonwebtoken');
jest.mock('@hbs/auth', () => ({
  TOKEN_TYPES: {
    EMAIL_VERIFICATION: 'email_verification',
    REFRESH: 'refresh',
    MFA_CHALLENGE: 'mfa_challenge',
    PASSWORD_RESET: 'password_reset',
  },
}), { virtual: true });

import jwt from 'jsonwebtoken';
import { VerifyEmailUseCase } from '../VerifyEmailUseCase';
import { LoggerFactory } from '@hbs/logging';

const mockJwt = jwt as jest.Mocked<typeof jwt>;

function makeLogger() {
  return LoggerFactory.getInstance().createUseCaseLogger('test') as any;
}

function makeUserRepo(overrides: Partial<any> = {}): any {
  return {
    getEmailVerificationData: jest.fn().mockResolvedValue(null),
    markEmailVerified: jest.fn().mockResolvedValue(undefined),
    clearEmailVerificationToken: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeSecurityEventRepo(overrides: Partial<any> = {}): any {
  return {
    create: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const VALID_TOKEN = 'valid.jwt.token';
const STORED_TOKEN = VALID_TOKEN;
const USER_ID = 'user-1';
const FUTURE_EXPIRY = new Date(Date.now() + 60_000);

describe('VerifyEmailUseCase', () => {
  let useCase: VerifyEmailUseCase;
  let userRepo: ReturnType<typeof makeUserRepo>;
  let securityEventRepo: ReturnType<typeof makeSecurityEventRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret';

    userRepo = makeUserRepo({
      getEmailVerificationData: jest.fn().mockResolvedValue({
        token: STORED_TOKEN,
        expiresAt: FUTURE_EXPIRY,
        emailVerified: false,
      }),
    });
    securityEventRepo = makeSecurityEventRepo();

    (mockJwt.verify as jest.Mock).mockReturnValue({
      userId: USER_ID,
      email: 'test@example.com',
      type: 'email_verification',
    });

    useCase = new VerifyEmailUseCase(userRepo, securityEventRepo, makeLogger());
  });

  describe('Happy path', () => {
    it('marks email as verified and returns success', async () => {
      const result = await useCase.execute({ token: VALID_TOKEN });

      expect(result.emailVerified).toBe(true);
      expect(result.timestamp).toBeDefined();
      expect(userRepo.markEmailVerified).toHaveBeenCalledWith(USER_ID);
      expect(securityEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, eventType: 'email_verified' }),
      );
    });

    it('returns success silently if already verified', async () => {
      userRepo.getEmailVerificationData.mockResolvedValue({
        token: STORED_TOKEN,
        expiresAt: FUTURE_EXPIRY,
        emailVerified: true,
      });

      const result = await useCase.execute({ token: VALID_TOKEN });

      expect(result.emailVerified).toBe(true);
      expect(userRepo.markEmailVerified).not.toHaveBeenCalled();
    });
  });

  describe('G-2: Token type validation', () => {
    it('throws if token type is wrong (not email_verification)', async () => {
      (mockJwt.verify as jest.Mock).mockReturnValue({
        userId: USER_ID,
        type: 'refresh', // wrong type
      });

      await expect(useCase.execute({ token: VALID_TOKEN })).rejects.toMatchObject({
        message: expect.stringContaining('Invalid token type'),
      });
    });
  });

  describe('Invalid / expired token', () => {
    it('throws if JWT verification fails (expired)', async () => {
      (mockJwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(useCase.execute({ token: 'expired.token' })).rejects.toMatchObject({
        message: expect.stringContaining('Invalid or expired'),
      });
    });

    it('throws if token does not match stored token (mismatch)', async () => {
      userRepo.getEmailVerificationData.mockResolvedValue({
        token: 'different-token',
        expiresAt: FUTURE_EXPIRY,
        emailVerified: false,
      });

      await expect(useCase.execute({ token: VALID_TOKEN })).rejects.toMatchObject({
        message: expect.stringContaining('Invalid or expired'),
      });
    });

    it('throws if DB-level expiry has passed', async () => {
      userRepo.getEmailVerificationData.mockResolvedValue({
        token: STORED_TOKEN,
        expiresAt: new Date(Date.now() - 60_000), // past expiry
        emailVerified: false,
      });

      await expect(useCase.execute({ token: VALID_TOKEN })).rejects.toMatchObject({
        message: expect.stringContaining('expired'),
      });
    });
  });

  describe('Missing token', () => {
    it('throws if token is empty', async () => {
      await expect(useCase.execute({ token: '' })).rejects.toMatchObject({
        message: expect.stringContaining('required'),
      });
    });
  });
});
