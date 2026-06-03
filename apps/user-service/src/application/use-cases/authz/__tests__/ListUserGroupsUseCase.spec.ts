jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { ListUserGroupsUseCase } from '../ListUserGroupsUseCase';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { UserGroupEntity } from '../../../../domain/entities/Authz';

function makeUserGroup(groupId: string): UserGroupEntity {
  return { userId: 'user-1', groupId, grantedAt: new Date(), grantedBy: null };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    listUserGroups: jest.fn().mockResolvedValue([makeUserGroup('g-1'), makeUserGroup('g-2')]),
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

describe('ListUserGroupsUseCase', () => {
  it('returns groups for a user', async () => {
    const repo = makeRepo();
    const uc = new ListUserGroupsUseCase(repo);
    const result = await uc.execute('user-1');
    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe('user-1');
    expect(repo.listUserGroups).toHaveBeenCalledWith('user-1');
  });

  it('returns empty array when user has no groups', async () => {
    const repo = makeRepo({ listUserGroups: jest.fn().mockResolvedValue([]) });
    const uc = new ListUserGroupsUseCase(repo);
    const result = await uc.execute('user-1');
    expect(result).toHaveLength(0);
  });
});
