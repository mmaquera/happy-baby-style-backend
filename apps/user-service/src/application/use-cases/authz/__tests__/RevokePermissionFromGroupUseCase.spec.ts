jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { RevokePermissionFromGroupUseCase } from '../RevokePermissionFromGroupUseCase';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { GroupPermissionEntity } from '../../../../domain/entities/Authz';

function makeLink(): GroupPermissionEntity {
  return { groupId: 'g-1', permissionId: 'p-1', createdAt: new Date() };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    findGroupPermission: jest.fn().mockResolvedValue(makeLink()),
    revokePermissionFromGroup: jest.fn().mockResolvedValue(undefined),
    findGroupById: jest.fn(),
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
    listGroupPermissions: jest.fn(),
    assignPermissionToGroup: jest.fn(),
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

describe('RevokePermissionFromGroupUseCase', () => {
  it('revokes permission from group successfully', async () => {
    const repo = makeRepo();
    const uc = new RevokePermissionFromGroupUseCase(repo);
    await uc.execute('g-1', 'p-1');
    expect(repo.revokePermissionFromGroup).toHaveBeenCalledWith('g-1', 'p-1');
  });

  it('throws NotFoundError when the link does not exist', async () => {
    const repo = makeRepo({ findGroupPermission: jest.fn().mockResolvedValue(null) });
    const uc = new RevokePermissionFromGroupUseCase(repo);
    await expect(uc.execute('g-1', 'p-1')).rejects.toBeInstanceOf(NotFoundError);
  });
});
