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
import { RequestEmailVerificationUseCase } from '../RequestEmailVerificationUseCase';
import { LoggerFactory } from '@hbs/logging';

const mockJwt = jwt as jest.Mocked<typeof jwt>;

function makeLogger() {
  return LoggerFactory.getInstance().createUseCaseLogger('test') as any;
}

function makeUserRepo(overrides: Partial<any> = {}): any {
  return {
    getUserByEmail: jest.fn().mockResolvedValue(null),
    setEmailVerificationToken: jest.fn().mockResolvedValue(undefined),
    getEmailVerificationData: jest.fn().mockResolvedValue(null),
    markEmailVerified: jest.fn().mockResolvedValue(undefined),
    clearEmailVerificationToken: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeEmailService(overrides: Partial<any> = {}): any {
  return {
    sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeSecurityEventRepo(overrides: Partial<any> = {}): any {
  return {
    create: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeUser(overrides: Partial<any> = {}): any {
  return {
    id: 'user-1',
    email: 'test@example.com',
    isActive: true,
    emailVerified: false,
    role: 'customer',
    profile: { firstName: 'John' },
    ...overrides,
  };
}

describe('RequestEmailVerificationUseCase', () => {
  let useCase: RequestEmailVerificationUseCase;
  let userRepo: ReturnType<typeof makeUserRepo>;
  let emailService: ReturnType<typeof makeEmailService>;
  let securityEventRepo: ReturnType<typeof makeSecurityEventRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.VERIFY_EMAIL_URL = 'http://localhost:3000/verify-email';

    userRepo = makeUserRepo();
    emailService = makeEmailService();
    securityEventRepo = makeSecurityEventRepo();

    (mockJwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

    useCase = new RequestEmailVerificationUseCase(
      userRepo,
      emailService,
      securityEventRepo,
      makeLogger(),
    );
  });

  describe('Happy path', () => {
    it('generates token, persists, and sends email for valid unverified user', async () => {
      const user = makeUser();
      userRepo.getUserByEmail.mockResolvedValue(user);

      const result = await useCase.execute({ email: 'test@example.com' });

      expect(result.email).toBe('test@example.com');
      expect(result.timestamp).toBeDefined();
      expect(userRepo.setEmailVerificationToken).toHaveBeenCalledWith('user-1', expect.objectContaining({
        token: 'mock-jwt-token',
        expiresAt: expect.any(Date),
      }));
      expect(emailService.sendEmailVerificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'mock-jwt-token',
        'John',
        expect.stringContaining('mock-jwt-token'),
      );
    });

    it('normalizes email to lowercase', async () => {
      const user = makeUser({ email: 'TEST@EXAMPLE.COM' });
      userRepo.getUserByEmail.mockResolvedValue(null); // normalized lookup

      const result = await useCase.execute({ email: '  TEST@EXAMPLE.COM  ' });

      expect(userRepo.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('Anti user-enumeration', () => {
    it('returns success silently for non-existent email', async () => {
      userRepo.getUserByEmail.mockResolvedValue(null);

      const result = await useCase.execute({ email: 'ghost@example.com' });

      expect(result.email).toBe('ghost@example.com');
      expect(userRepo.setEmailVerificationToken).not.toHaveBeenCalled();
      expect(emailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
    });

    it('returns success silently for already-verified email', async () => {
      userRepo.getUserByEmail.mockResolvedValue(makeUser({ emailVerified: true }));

      const result = await useCase.execute({ email: 'test@example.com' });

      expect(result.email).toBe('test@example.com');
      expect(userRepo.setEmailVerificationToken).not.toHaveBeenCalled();
      expect(emailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('Email send failure (best-effort)', () => {
    it('does NOT throw if email service fails — token is still stored', async () => {
      userRepo.getUserByEmail.mockResolvedValue(makeUser());
      emailService.sendEmailVerificationEmail.mockRejectedValue(new Error('SMTP down'));

      const result = await useCase.execute({ email: 'test@example.com' });

      expect(result.email).toBe('test@example.com');
      expect(userRepo.setEmailVerificationToken).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('throws ValidationError for invalid email format', async () => {
      await expect(useCase.execute({ email: 'not-an-email' })).rejects.toMatchObject({
        message: expect.stringContaining('Invalid email format'),
      });
    });
  });

  describe('Bug #6: email resend cooldown', () => {
    it('skips resend if a non-expired token was issued less than 5 minutes ago', async () => {
      const user = makeUser();
      userRepo.getUserByEmail.mockResolvedValue(user);

      const iatTwoMinutesAgo = Math.floor(Date.now() / 1000) - 120;
      // jwt.decode is called (not jwt.verify) — mock it to return the iat
      (mockJwt.decode as jest.Mock).mockReturnValueOnce({ iat: iatTwoMinutesAgo });

      userRepo.getEmailVerificationData.mockResolvedValue({
        token: 'recent.token.here',
        expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000), // not expired
        emailVerified: false,
      });

      const result = await useCase.execute({ email: 'test@example.com' });

      expect(result.email).toBe('test@example.com');
      // No new token should be issued or sent
      expect(userRepo.setEmailVerificationToken).not.toHaveBeenCalled();
      expect(emailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
    });

    it('allows resend if the prior token was issued more than 5 minutes ago', async () => {
      const user = makeUser();
      userRepo.getUserByEmail.mockResolvedValue(user);

      const iatSixMinutesAgo = Math.floor(Date.now() / 1000) - 360;
      (mockJwt.decode as jest.Mock).mockReturnValueOnce({ iat: iatSixMinutesAgo });

      userRepo.getEmailVerificationData.mockResolvedValue({
        token: 'old.token.here',
        expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000), // not expired yet
        emailVerified: false,
      });

      await useCase.execute({ email: 'test@example.com' });

      // Cooldown has passed — a new token should be issued
      expect(userRepo.setEmailVerificationToken).toHaveBeenCalled();
      expect(emailService.sendEmailVerificationEmail).toHaveBeenCalled();
    });

    it('allows resend if the prior token is already expired (regardless of iat)', async () => {
      const user = makeUser();
      userRepo.getUserByEmail.mockResolvedValue(user);

      userRepo.getEmailVerificationData.mockResolvedValue({
        token: 'expired.token.here',
        expiresAt: new Date(Date.now() - 1000), // expired
        emailVerified: false,
      });

      await useCase.execute({ email: 'test@example.com' });

      expect(userRepo.setEmailVerificationToken).toHaveBeenCalled();
    });

    it('issues token normally when no prior verification data exists', async () => {
      const user = makeUser();
      userRepo.getUserByEmail.mockResolvedValue(user);
      userRepo.getEmailVerificationData.mockResolvedValue(null);

      await useCase.execute({ email: 'test@example.com' });

      expect(userRepo.setEmailVerificationToken).toHaveBeenCalled();
      expect(emailService.sendEmailVerificationEmail).toHaveBeenCalled();
    });
  });
});
