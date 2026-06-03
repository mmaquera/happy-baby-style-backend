jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { CreatePermissionUseCase } from '../CreatePermissionUseCase';
import { ValidationError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { AuthPermissionEntity } from '../../../../domain/entities/Authz';

function makePermission(overrides: Partial<AuthPermissionEntity> = {}): AuthPermissionEntity {
  return {
    id: 'p-1',
    code: 'orders:write',
    name: 'Write Orders',
    description: null,
    category: 'orders',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    findPermissionByCode: jest.fn().mockResolvedValue(null),
    createPermission: jest.fn().mockResolvedValue(makePermission()),
    findGroupById: jest.fn(),
    findGroupByCode: jest.fn(),
    listGroups: jest.fn(),
    createGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
    countGroupRelations: jest.fn(),
    findPermissionById: jest.fn(),
    listPermissions: jest.fn(),
    updatePermission: jest.fn(),
    deletePermission: jest.fn(),
    countPermissionUsage: jest.fn(),
    findUserGroup: jest.fn(),
    listUserGroups: jest.fn(),
    assignUserToGroup: jest.fn(),
    removeUserFromGroup: jest.fn(),
    findGroupPermission: jest.fn(),
    listGroupPermissions: jest.fn(),
    assignPermissionToGroup: jest.fn(),
    revokePermissionFromGroup: jest.fn(),
    findImplication: jest.fn(),
    listGroupImplications: jest.fn(),
    addGroupImplication: jest.fn(),
    removeGroupImplication: jest.fn(),
    findRecordRuleById: jest.fn(),
    listRecordRules: jest.fn(),
    createRecordRule: jest.fn(),
    updateRecordRule: jest.fn(),
    deleteRecordRule: jest.fn(),
    ...overrides,
  } as IAuthzRepository;
}

describe('CreatePermissionUseCase', () => {
  it('creates a permission with valid input', async () => {
    const repo = makeRepo();
    const uc = new CreatePermissionUseCase(repo);
    const result = await uc.execute({ code: 'orders:write', name: 'Write Orders', category: 'orders' });
    expect(result.code).toBe('orders:write');
    expect(repo.createPermission).toHaveBeenCalled();
  });

  it('throws ValidationError when code already exists', async () => {
    const repo = makeRepo({ findPermissionByCode: jest.fn().mockResolvedValue(makePermission()) });
    const uc = new CreatePermissionUseCase(repo);
    await expect(uc.execute({ code: 'orders:write', name: 'Duplicate', category: 'orders' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for invalid code format (uppercase)', async () => {
    const repo = makeRepo();
    const uc = new CreatePermissionUseCase(repo);
    await expect(uc.execute({ code: 'Orders:Write', name: 'Test', category: 'orders' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when code is too short (single char)', async () => {
    const repo = makeRepo();
    const uc = new CreatePermissionUseCase(repo);
    await expect(uc.execute({ code: 'a', name: 'Test', category: 'orders' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when name is empty', async () => {
    const repo = makeRepo();
    const uc = new CreatePermissionUseCase(repo);
    await expect(uc.execute({ code: 'orders:write', name: '', category: 'orders' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when category is empty', async () => {
    const repo = makeRepo();
    const uc = new CreatePermissionUseCase(repo);
    await expect(uc.execute({ code: 'orders:write', name: 'Write Orders', category: '' })).rejects.toBeInstanceOf(ValidationError);
  });
});
