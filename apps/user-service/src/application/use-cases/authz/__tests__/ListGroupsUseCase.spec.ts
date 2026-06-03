jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { ListGroupsUseCase } from '../ListGroupsUseCase';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { AuthGroupEntity } from '../../../../domain/entities/Authz';

function makeGroup(code: string): AuthGroupEntity {
  return { id: `g-${code}`, code, name: code, description: null, isSystem: false, createdAt: new Date(), updatedAt: new Date() };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    listGroups: jest.fn().mockResolvedValue({ items: [makeGroup('admins'), makeGroup('customers')], total: 2 }),
    findGroupById: jest.fn(),
    findGroupByCode: jest.fn(),
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

describe('ListGroupsUseCase', () => {
  it('returns groups with default pagination', async () => {
    const repo = makeRepo();
    const uc = new ListGroupsUseCase(repo);
    const result = await uc.execute({});
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(repo.listGroups).toHaveBeenCalledWith({ limit: 50, offset: 0 });
  });

  it('passes custom pagination to repo', async () => {
    const repo = makeRepo();
    const uc = new ListGroupsUseCase(repo);
    await uc.execute({ limit: 10, offset: 20 });
    expect(repo.listGroups).toHaveBeenCalledWith({ limit: 10, offset: 20 });
  });

  it('returns empty list when no groups exist', async () => {
    const repo = makeRepo({ listGroups: jest.fn().mockResolvedValue({ items: [], total: 0 }) });
    const uc = new ListGroupsUseCase(repo);
    const result = await uc.execute({});
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
