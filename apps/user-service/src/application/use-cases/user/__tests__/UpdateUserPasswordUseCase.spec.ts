jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
  LoggingDecorator: {
    logUseCase: () => (_target: any, _key: any, descriptor: PropertyDescriptor) => descriptor,
  },
}), { virtual: true });

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('jwt-token'),
  verify: jest.fn().mockReturnValue({ userId: 'user-1', email: 'jane@test.com', type: 'password_reset' }),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashed'),
}));

import { UpdateUserPasswordUseCase, UpdateUserPasswordRequest } from '../UpdateUserPasswordUseCase';
import type { IAuthRepository } from '../../../../domain/repositories/IAuthRepository';
import type { IAuditRepository } from '../../../../domain/repositories/IAuditRepository';
import type { ISecurityEventRepository } from '../../../../domain/repositories/ISecurityEventRepository';
import type { IEmailService } from '../../../../domain/interfaces/IEmailService';
import type { ILogger } from '@hbs/logging';
import { ValidationError, NotFoundError, UnauthorizedError, BusinessLogicError } from '../../../../domain/errors/DomainError';

function makeLogger(): ILogger {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
}

function makeAuthRepo(overrides: Partial<IAuthRepository> = {}): jest.Mocked<IAuthRepository> {
  return {
    getUserByEmail: jest.fn().mockResolvedValue({ id: 'user-1', email: 'jane@test.com', isActive: true }),
    verifyPassword: jest.fn().mockResolvedValue(true),
    findUserPasswordByUserId: jest.fn().mockResolvedValue({ passwordHash: 'oldHash' }),
    updatePassword: jest.fn().mockResolvedValue(undefined),
    updateUserPassword: jest.fn().mockResolvedValue({}),
    clearMustChangePassword: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

function makeAuditRepo(): jest.Mocked<IAuditRepository> {
  return { create: jest.fn().mockResolvedValue({}) } as any;
}

function makeSecurityRepo(): jest.Mocked<ISecurityEventRepository> {
  return { create: jest.fn().mockResolvedValue({}) } as any;
}

function makeEmailService(): jest.Mocked<IEmailService> {
  return {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
  } as any;
}

const validReq = (): UpdateUserPasswordRequest => ({
  email: 'jane@test.com',
  currentPassword: 'OldPass1!',
  newPassword: 'NewSecure1!',
  confirmPassword: 'NewSecure1!',
});

describe('UpdateUserPasswordUseCase', () => {
  it('updates password when all inputs are valid', async () => {
    const authRepo = makeAuthRepo();
    const uc = new UpdateUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeEmailService(), makeLogger());
    await uc.execute(validReq());
    expect(authRepo.updatePassword).toHaveBeenCalledWith('user-1', 'NewSecure1!');
  });

  it('throws NotFoundError when user does not exist', async () => {
    const authRepo = makeAuthRepo({ getUserByEmail: jest.fn().mockResolvedValue(null) });
    const uc = new UpdateUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeEmailService(), makeLogger());
    await expect(uc.execute(validReq())).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws UnauthorizedError when user is inactive', async () => {
    const authRepo = makeAuthRepo({
      getUserByEmail: jest.fn().mockResolvedValue({ id: 'user-1', email: 'jane@test.com', isActive: false }),
    });
    const uc = new UpdateUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeEmailService(), makeLogger());
    await expect(uc.execute(validReq())).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws UnauthorizedError when current password is incorrect', async () => {
    const authRepo = makeAuthRepo({ verifyPassword: jest.fn().mockResolvedValue(false) });
    const uc = new UpdateUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeEmailService(), makeLogger());
    await expect(uc.execute(validReq())).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws ValidationError when passwords do not match', async () => {
    const authRepo = makeAuthRepo();
    const uc = new UpdateUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeEmailService(), makeLogger());
    await expect(uc.execute({ ...validReq(), confirmPassword: 'DifferentPass1!' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws BusinessLogicError when new password is same as current', async () => {
    const authRepo = makeAuthRepo();
    const uc = new UpdateUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeEmailService(), makeLogger());
    await expect(uc.execute({ ...validReq(), newPassword: 'OldPass1!', confirmPassword: 'OldPass1!' })).rejects.toBeInstanceOf(BusinessLogicError);
  });

  it('throws ValidationError when email is missing', async () => {
    const authRepo = makeAuthRepo();
    const uc = new UpdateUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeEmailService(), makeLogger());
    await expect(uc.execute({ ...validReq(), email: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when email is invalid', async () => {
    const authRepo = makeAuthRepo();
    const uc = new UpdateUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeEmailService(), makeLogger());
    await expect(uc.execute({ ...validReq(), email: 'bad-email' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('still updates password if security event fails', async () => {
    const authRepo = makeAuthRepo();
    const securityRepo = { create: jest.fn().mockRejectedValue(new Error('event fail')) } as any;
    const uc = new UpdateUserPasswordUseCase(authRepo, makeAuditRepo(), securityRepo, makeEmailService(), makeLogger());
    await expect(uc.execute(validReq())).resolves.toBeUndefined();
    expect(authRepo.updatePassword).toHaveBeenCalled();
  });
});
