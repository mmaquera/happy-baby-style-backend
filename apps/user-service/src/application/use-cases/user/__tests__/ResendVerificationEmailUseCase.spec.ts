jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

jest.mock('@hbs/auth', () => ({
  TOKEN_TYPES: {
    EMAIL_VERIFICATION: 'email_verification',
  },
}), { virtual: true });

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  decode: jest.fn().mockReturnValue(null),
}));

import { ResendVerificationEmailUseCase, ResendVerificationEmailRequest } from '../ResendVerificationEmailUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { IEmailService } from '../../../../domain/interfaces/IEmailService';
import type { ISecurityEventRepository } from '../../../../domain/repositories/ISecurityEventRepository';
import type { ILogger } from '@hbs/logging';
import type { User } from '../../../../domain/entities/User';
import { ValidationError } from '../../../../domain/errors/DomainError';

function makeLogger(): ILogger {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'jane@test.com',
    isActive: true,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeUserRepo(overrides: Partial<IUserRepository> = {}): jest.Mocked<IUserRepository> {
  return {
    getUserByEmail: jest.fn().mockResolvedValue(makeUser()),
    getEmailVerificationData: jest.fn().mockResolvedValue(null),
    setEmailVerificationToken: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

function makeEmailService(): jest.Mocked<IEmailService> {
  return { sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined) } as any;
}

function makeSecurityRepo(): jest.Mocked<ISecurityEventRepository> {
  return { create: jest.fn().mockResolvedValue({}) } as any;
}

describe('ResendVerificationEmailUseCase', () => {
  it('sends verification email to an unverified user', async () => {
    const userRepo = makeUserRepo();
    const emailService = makeEmailService();
    const uc = new ResendVerificationEmailUseCase(userRepo, emailService, makeSecurityRepo(), makeLogger());
    const result = await uc.execute({ email: 'jane@test.com' });
    expect(result.email).toBe('jane@test.com');
    expect(userRepo.setEmailVerificationToken).toHaveBeenCalled();
    expect(emailService.sendEmailVerificationEmail).toHaveBeenCalled();
  });

  it('returns success silently when user does not exist (anti-enumeration)', async () => {
    const userRepo = makeUserRepo({ getUserByEmail: jest.fn().mockResolvedValue(null) });
    const uc = new ResendVerificationEmailUseCase(userRepo, makeEmailService(), makeSecurityRepo(), makeLogger());
    const result = await uc.execute({ email: 'unknown@test.com' });
    expect(result.email).toBe('unknown@test.com');
  });

  it('returns success without re-sending when email is already verified', async () => {
    const userRepo = makeUserRepo({
      getUserByEmail: jest.fn().mockResolvedValue(makeUser({ emailVerified: true })),
    });
    const emailService = makeEmailService();
    const uc = new ResendVerificationEmailUseCase(userRepo, emailService, makeSecurityRepo(), makeLogger());
    await uc.execute({ email: 'jane@test.com' });
    expect(emailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it('throws ValidationError for invalid email format', async () => {
    const userRepo = makeUserRepo();
    const uc = new ResendVerificationEmailUseCase(userRepo, makeEmailService(), makeSecurityRepo(), makeLogger());
    await expect(uc.execute({ email: 'not-an-email' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('still returns success when email sending fails', async () => {
    const userRepo = makeUserRepo();
    const emailService = { sendEmailVerificationEmail: jest.fn().mockRejectedValue(new Error('SMTP fail')) } as any;
    const uc = new ResendVerificationEmailUseCase(userRepo, emailService, makeSecurityRepo(), makeLogger());
    const result = await uc.execute({ email: 'jane@test.com' });
    expect(result.email).toBe('jane@test.com');
  });
});
