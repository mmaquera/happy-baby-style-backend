jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { UpdatePermissionUseCase } from '../UpdatePermissionUseCase';
import { NotFoundError } from '@hbs/shared-kernel';
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
    findPermissionById: jest.fn().mockResolvedValue(makePermission()),
    updatePermission: jest.fn().mockResolvedValue(makePermission({ name: 'Updated Orders Write' })),
    findGroupById: jest.fn(),
    findGroupByCode: jest.fn(),
    listGroups: jest.fn(),
    createGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
    countGroupRelations: jest.fn(),
    findPermissionByCode: jest.fn(),
    listPermissions: jest.fn(),
    createPermission: jest.fn(),
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

describe('UpdatePermissionUseCase', () => {
  it('updates permission name successfully', async () => {
    const repo = makeRepo();
    const uc = new UpdatePermissionUseCase(repo);
    const result = await uc.execute('p-1', { name: 'Updated Orders Write' });
    expect(repo.updatePermission).toHaveBeenCalledWith('p-1', { name: 'Updated Orders Write' });
    expect(result.name).toBe('Updated Orders Write');
  });

  it('throws NotFoundError when permission does not exist', async () => {
    const repo = makeRepo({ findPermissionById: jest.fn().mockResolvedValue(null) });
    const uc = new UpdatePermissionUseCase(repo);
    await expect(uc.execute('p-1', { name: 'New Name' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updates category and description', async () => {
    const repo = makeRepo({
      updatePermission: jest.fn().mockResolvedValue(makePermission({ category: 'products', description: 'New desc' })),
    });
    const uc = new UpdatePermissionUseCase(repo);
    const result = await uc.execute('p-1', { category: 'products', description: 'New desc' });
    expect(repo.updatePermission).toHaveBeenCalledWith('p-1', { category: 'products', description: 'New desc' });
  });
});
