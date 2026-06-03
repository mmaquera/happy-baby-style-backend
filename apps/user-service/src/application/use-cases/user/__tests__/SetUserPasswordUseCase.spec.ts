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

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
}));

import { SetUserPasswordUseCase, SetUserPasswordRequest } from '../SetUserPasswordUseCase';
import type { IAuthRepository } from '../../../../domain/repositories/IAuthRepository';
import type { IAuditRepository } from '../../../../domain/repositories/IAuditRepository';
import type { ISecurityEventRepository } from '../../../../domain/repositories/ISecurityEventRepository';
import type { ILogger } from '@hbs/logging';
import { ValidationError, NotFoundError, BusinessLogicError } from '../../../../domain/errors/DomainError';

function makeLogger(): ILogger {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
}

function makeAuthRepo(overrides: Partial<IAuthRepository> = {}): jest.Mocked<IAuthRepository> {
  return {
    getUserById: jest.fn().mockResolvedValue({ id: 'user-1', email: 'jane@test.com', isActive: true }),
    findUserPasswordByUserId: jest.fn().mockResolvedValue({ passwordHash: 'oldHash', resetToken: undefined, resetExpiresAt: undefined }),
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

const validReq = (): SetUserPasswordRequest => ({
  userId: 'user-1',
  newPassword: 'SecurePass1!',
  adminUserId: 'admin-1',
});

describe('SetUserPasswordUseCase', () => {
  it('sets password successfully for an active user', async () => {
    const authRepo = makeAuthRepo();
    const uc = new SetUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeLogger());
    await uc.execute(validReq());
    expect(authRepo.updateUserPassword).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ passwordHash: '$2b$12$hashedpassword' }),
    );
  });

  it('throws NotFoundError when user does not exist', async () => {
    const authRepo = makeAuthRepo({ getUserById: jest.fn().mockResolvedValue(null) });
    const uc = new SetUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeLogger());
    await expect(uc.execute(validReq())).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws BusinessLogicError for inactive user', async () => {
    const authRepo = makeAuthRepo({
      getUserById: jest.fn().mockResolvedValue({ id: 'user-1', email: 'jane@test.com', isActive: false }),
    });
    const uc = new SetUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeLogger());
    await expect(uc.execute(validReq())).rejects.toBeInstanceOf(BusinessLogicError);
  });

  it('throws ValidationError when userId is missing', async () => {
    const authRepo = makeAuthRepo();
    const uc = new SetUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeLogger());
    await expect(uc.execute({ ...validReq(), userId: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when newPassword is missing', async () => {
    const authRepo = makeAuthRepo();
    const uc = new SetUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeLogger());
    await expect(uc.execute({ ...validReq(), newPassword: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when adminUserId is missing', async () => {
    const authRepo = makeAuthRepo();
    const uc = new SetUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeLogger());
    await expect(uc.execute({ ...validReq(), adminUserId: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when password is too weak', async () => {
    const authRepo = makeAuthRepo();
    const uc = new SetUserPasswordUseCase(authRepo, makeAuditRepo(), makeSecurityRepo(), makeLogger());
    await expect(uc.execute({ ...validReq(), newPassword: 'abc' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('still sets password even if security event creation fails', async () => {
    const authRepo = makeAuthRepo();
    const securityRepo = { create: jest.fn().mockRejectedValue(new Error('event fail')) } as any;
    const uc = new SetUserPasswordUseCase(authRepo, makeAuditRepo(), securityRepo, makeLogger());
    await expect(uc.execute(validReq())).resolves.toBeUndefined();
    expect(authRepo.updateUserPassword).toHaveBeenCalled();
  });

  it('still sets password even if audit log creation fails', async () => {
    const authRepo = makeAuthRepo();
    const auditRepo = { create: jest.fn().mockRejectedValue(new Error('audit fail')) } as any;
    const uc = new SetUserPasswordUseCase(authRepo, auditRepo, makeSecurityRepo(), makeLogger());
    await expect(uc.execute(validReq())).resolves.toBeUndefined();
    expect(authRepo.updateUserPassword).toHaveBeenCalled();
  });
});
