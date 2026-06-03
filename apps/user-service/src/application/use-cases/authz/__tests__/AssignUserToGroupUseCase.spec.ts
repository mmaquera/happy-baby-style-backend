jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { AssignUserToGroupUseCase } from '../AssignUserToGroupUseCase';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { AuthGroupEntity, UserGroupEntity } from '../../../../domain/entities/Authz';

function makeGroup(overrides: Partial<AuthGroupEntity> = {}): AuthGroupEntity {
  return { id: 'g-1', code: 'customer', name: 'Customer', description: null, isSystem: false, createdAt: new Date(), updatedAt: new Date(), ...overrides };
}

function makeMembership(): UserGroupEntity {
  return { userId: 'user-1', groupId: 'g-1', grantedAt: new Date(), grantedBy: null };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    findGroupById: jest.fn().mockResolvedValue(makeGroup()),
    findUserGroup: jest.fn().mockResolvedValue(null),
    assignUserToGroup: jest.fn().mockResolvedValue(makeMembership()),
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

describe('AssignUserToGroupUseCase', () => {
  it('assigns user to group successfully', async () => {
    const repo = makeRepo();
    const uc = new AssignUserToGroupUseCase(repo);
    const result = await uc.execute({ userId: 'user-1', groupId: 'g-1', grantedBy: 'admin-1' });
    expect(result.userId).toBe('user-1');
    expect(result.groupId).toBe('g-1');
    expect(repo.assignUserToGroup).toHaveBeenCalled();
  });

  it('throws NotFoundError when group does not exist', async () => {
    const repo = makeRepo({ findGroupById: jest.fn().mockResolvedValue(null) });
    const uc = new AssignUserToGroupUseCase(repo);
    await expect(uc.execute({ userId: 'user-1', groupId: 'g-1' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns existing membership idempotently', async () => {
    const existing = makeMembership();
    const repo = makeRepo({ findUserGroup: jest.fn().mockResolvedValue(existing) });
    const uc = new AssignUserToGroupUseCase(repo);
    const result = await uc.execute({ userId: 'user-1', groupId: 'g-1' });
    expect(result).toBe(existing);
    expect(repo.assignUserToGroup).not.toHaveBeenCalled();
  });
});
