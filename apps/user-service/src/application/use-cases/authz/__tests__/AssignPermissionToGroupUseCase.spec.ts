jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { AssignPermissionToGroupUseCase } from '../AssignPermissionToGroupUseCase';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { AuthGroupEntity, AuthPermissionEntity, GroupPermissionEntity } from '../../../../domain/entities/Authz';

function makeGroup(overrides: Partial<AuthGroupEntity> = {}): AuthGroupEntity {
  return { id: 'g-1', code: 'sales-user', name: 'Sales User', description: null, isSystem: false, createdAt: new Date(), updatedAt: new Date(), ...overrides };
}

function makePermission(overrides: Partial<AuthPermissionEntity> = {}): AuthPermissionEntity {
  return { id: 'p-1', code: 'orders:write', name: 'Write Orders', description: null, category: 'orders', createdAt: new Date(), updatedAt: new Date(), ...overrides };
}

function makeLink(): GroupPermissionEntity {
  return { groupId: 'g-1', permissionId: 'p-1', createdAt: new Date() };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    findGroupById: jest.fn().mockResolvedValue(makeGroup()),
    findPermissionById: jest.fn().mockResolvedValue(makePermission()),
    findGroupPermission: jest.fn().mockResolvedValue(null),
    assignPermissionToGroup: jest.fn().mockResolvedValue(makeLink()),
    findGroupByCode: jest.fn(),
    listGroups: jest.fn(),
    createGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
    countGroupRelations: jest.fn(),
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

describe('AssignPermissionToGroupUseCase', () => {
  it('assigns permission to group successfully', async () => {
    const repo = makeRepo();
    const uc = new AssignPermissionToGroupUseCase(repo);
    const result = await uc.execute('g-1', 'p-1');
    expect(result.groupId).toBe('g-1');
    expect(result.permissionId).toBe('p-1');
    expect(repo.assignPermissionToGroup).toHaveBeenCalledWith('g-1', 'p-1');
  });

  it('throws NotFoundError when group does not exist', async () => {
    const repo = makeRepo({ findGroupById: jest.fn().mockResolvedValue(null) });
    const uc = new AssignPermissionToGroupUseCase(repo);
    await expect(uc.execute('g-1', 'p-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when permission does not exist', async () => {
    const repo = makeRepo({ findPermissionById: jest.fn().mockResolvedValue(null) });
    const uc = new AssignPermissionToGroupUseCase(repo);
    await expect(uc.execute('g-1', 'p-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns existing link idempotently when assignment already exists', async () => {
    const existing = makeLink();
    const repo = makeRepo({ findGroupPermission: jest.fn().mockResolvedValue(existing) });
    const uc = new AssignPermissionToGroupUseCase(repo);
    const result = await uc.execute('g-1', 'p-1');
    expect(result).toBe(existing);
    expect(repo.assignPermissionToGroup).not.toHaveBeenCalled();
  });
});
