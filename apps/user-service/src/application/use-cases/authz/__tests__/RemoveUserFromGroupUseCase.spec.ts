jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { RemoveUserFromGroupUseCase } from '../RemoveUserFromGroupUseCase';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { UserGroupEntity } from '../../../../domain/entities/Authz';

function makeMembership(): UserGroupEntity {
  return { userId: 'user-1', groupId: 'g-1', grantedAt: new Date(), grantedBy: null };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    findUserGroup: jest.fn().mockResolvedValue(makeMembership()),
    removeUserFromGroup: jest.fn().mockResolvedValue(undefined),
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
    listUserGroups: jest.fn(),
    assignUserToGroup: jest.fn(),
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

describe('RemoveUserFromGroupUseCase', () => {
  it('removes user from group successfully', async () => {
    const repo = makeRepo();
    const uc = new RemoveUserFromGroupUseCase(repo);
    await uc.execute('user-1', 'g-1');
    expect(repo.removeUserFromGroup).toHaveBeenCalledWith('user-1', 'g-1');
  });

  it('throws NotFoundError when membership does not exist', async () => {
    const repo = makeRepo({ findUserGroup: jest.fn().mockResolvedValue(null) });
    const uc = new RemoveUserFromGroupUseCase(repo);
    await expect(uc.execute('user-1', 'g-1')).rejects.toBeInstanceOf(NotFoundError);
  });
});
