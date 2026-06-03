jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { ListGroupPermissionsUseCase } from '../ListGroupPermissionsUseCase';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { AuthGroupEntity, GroupPermissionEntity } from '../../../../domain/entities/Authz';

function makeGroup(): AuthGroupEntity {
  return { id: 'g-1', code: 'sales-user', name: 'Sales User', description: null, isSystem: false, createdAt: new Date(), updatedAt: new Date() };
}

function makeGroupPermission(): GroupPermissionEntity {
  return { groupId: 'g-1', permissionId: 'p-1', createdAt: new Date() };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    findGroupById: jest.fn().mockResolvedValue(makeGroup()),
    listGroupPermissions: jest.fn().mockResolvedValue([makeGroupPermission()]),
    findGroupByCode: jest.fn(),
    listGroups: jest.fn(),
    createGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
    countGroupRelations: jest.fn(),
    findPermissionById: jest.fn(),
    findPermissionByCode: jest.fn(),
    listPermissions: jest.fn(),
    createPermission: jest.fn(),
    updatePermission: jest.fn(),
    deletePermission: jest.fn(),
    countPermissionUsage: jest.fn(),
    findUserGroup: jest.fn(),
    listUserGroups: jest.fn(),
    assignUserToGroup: jest.fn(),
    removeUserFromGroup: jest.fn(),
    findGroupPermission: jest.fn(),
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

describe('ListGroupPermissionsUseCase', () => {
  it('returns permissions for a valid group', async () => {
    const repo = makeRepo();
    const uc = new ListGroupPermissionsUseCase(repo);
    const result = await uc.execute('g-1');
    expect(result).toHaveLength(1);
    expect(result[0].groupId).toBe('g-1');
    expect(repo.listGroupPermissions).toHaveBeenCalledWith('g-1');
  });

  it('throws NotFoundError when group does not exist', async () => {
    const repo = makeRepo({ findGroupById: jest.fn().mockResolvedValue(null) });
    const uc = new ListGroupPermissionsUseCase(repo);
    await expect(uc.execute('g-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns empty array when group has no permissions', async () => {
    const repo = makeRepo({ listGroupPermissions: jest.fn().mockResolvedValue([]) });
    const uc = new ListGroupPermissionsUseCase(repo);
    const result = await uc.execute('g-1');
    expect(result).toHaveLength(0);
  });
});
