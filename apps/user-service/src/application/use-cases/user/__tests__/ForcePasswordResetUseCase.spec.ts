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

import { ForcePasswordResetUseCase } from '../ForcePasswordResetUseCase';
import type { IUserRepository } from '../../../../domain/repositories/IUserRepository';
import type { IAuthRepository } from '../../../../domain/repositories/IAuthRepository';
import type { IAuditRepository } from '../../../../domain/repositories/IAuditRepository';
import type { User } from '../../../../domain/entities/User';
import { NotFoundError, ValidationError } from '../../../../domain/errors/DomainError';

const TARGET_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ADMIN_USER_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: TARGET_USER_ID,
    email: 'target@test.com',
    isActive: true,
    emailVerified: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeLogger(): any {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), fatal: jest.fn(), child: jest.fn(), setTraceId: jest.fn() };
}

function makeUserRepo(user: User | null = makeUser()): jest.Mocked<Pick<IUserRepository, 'getUserById'>> {
  return { getUserById: jest.fn().mockResolvedValue(user) } as any;
}

function makeAuthRepo(): jest.Mocked<Pick<IAuthRepository, 'setMustChangePassword' | 'getMustChangePasswordAt' | 'clearMustChangePassword'>> {
  return {
    setMustChangePassword: jest.fn().mockResolvedValue(undefined),
    getMustChangePasswordAt: jest.fn().mockResolvedValue(null),
    clearMustChangePassword: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function makeAuditRepo(): jest.Mocked<Pick<IAuditRepository, 'create'>> {
  return {
    create: jest.fn().mockResolvedValue({ id: 'audit-1', action: 'password_reset', createdAt: new Date() }),
  } as any;
}

describe('ForcePasswordResetUseCase', () => {
  it('sets mustChangePasswordAt and returns the result', async () => {
    const userRepo = makeUserRepo();
    const authRepo = makeAuthRepo();
    const auditRepo = makeAuditRepo();
    const logger = makeLogger();

    const uc = new ForcePasswordResetUseCase(userRepo as any, authRepo as any, auditRepo as any, logger);
    const result = await uc.execute({
      targetUserId: TARGET_USER_ID,
      adminUserId: ADMIN_USER_ID,
    });

    expect(result.targetUserId).toBe(TARGET_USER_ID);
    expect(result.forcedAt).toBeInstanceOf(Date);
    expect(authRepo.setMustChangePassword).toHaveBeenCalledWith(
      TARGET_USER_ID,
      expect.any(Date),
    );
  });

  it('writes an audit log with the admin userId', async () => {
    const userRepo = makeUserRepo();
    const authRepo = makeAuthRepo();
    const auditRepo = makeAuditRepo();
    const logger = makeLogger();

    const uc = new ForcePasswordResetUseCase(userRepo as any, authRepo as any, auditRepo as any, logger);
    await uc.execute({ targetUserId: TARGET_USER_ID, adminUserId: ADMIN_USER_ID });

    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ADMIN_USER_ID,
        recordId: TARGET_USER_ID,
      }),
    );
  });

  it('throws NotFoundError when target user does not exist', async () => {
    const userRepo = makeUserRepo(null);
    const authRepo = makeAuthRepo();
    const auditRepo = makeAuditRepo();
    const logger = makeLogger();

    const uc = new ForcePasswordResetUseCase(userRepo as any, authRepo as any, auditRepo as any, logger);
    await expect(
      uc.execute({ targetUserId: TARGET_USER_ID, adminUserId: ADMIN_USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(authRepo.setMustChangePassword).not.toHaveBeenCalled();
    expect(auditRepo.create).not.toHaveBeenCalled();
  });

  it('throws ValidationError when targetUserId is empty', async () => {
    const userRepo = makeUserRepo();
    const authRepo = makeAuthRepo();
    const auditRepo = makeAuditRepo();
    const logger = makeLogger();

    const uc = new ForcePasswordResetUseCase(userRepo as any, authRepo as any, auditRepo as any, logger);
    await expect(
      uc.execute({ targetUserId: '', adminUserId: ADMIN_USER_ID }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when adminUserId is empty', async () => {
    const userRepo = makeUserRepo();
    const authRepo = makeAuthRepo();
    const auditRepo = makeAuditRepo();
    const logger = makeLogger();

    const uc = new ForcePasswordResetUseCase(userRepo as any, authRepo as any, auditRepo as any, logger);
    await expect(
      uc.execute({ targetUserId: TARGET_USER_ID, adminUserId: '' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('propagates error if setMustChangePassword fails', async () => {
    const userRepo = makeUserRepo();
    const authRepo = makeAuthRepo();
    const dbError = new Error('DB failure');
    authRepo.setMustChangePassword = jest.fn().mockRejectedValue(dbError);
    const auditRepo = makeAuditRepo();
    const logger = makeLogger();

    const uc = new ForcePasswordResetUseCase(userRepo as any, authRepo as any, auditRepo as any, logger);
    await expect(
      uc.execute({ targetUserId: TARGET_USER_ID, adminUserId: ADMIN_USER_ID }),
    ).rejects.toThrow('DB failure');
  });
});
