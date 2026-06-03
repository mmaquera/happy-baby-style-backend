jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { ListPermissionsUseCase } from '../ListPermissionsUseCase';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { AuthPermissionEntity } from '../../../../domain/entities/Authz';

function makePermission(code: string): AuthPermissionEntity {
  return { id: `p-${code}`, code, name: code, description: null, category: 'test', createdAt: new Date(), updatedAt: new Date() };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    listPermissions: jest.fn().mockResolvedValue({ items: [makePermission('orders:read'), makePermission('orders:write')], total: 2 }),
    findGroupById: jest.fn(),
    findGroupByCode: jest.fn(),
    listGroups: jest.fn(),
    createGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
    countGroupRelations: jest.fn(),
    findPermissionById: jest.fn(),
    findPermissionByCode: jest.fn(),
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

describe('ListPermissionsUseCase', () => {
  it('returns permissions with default pagination', async () => {
    const repo = makeRepo();
    const uc = new ListPermissionsUseCase(repo);
    const result = await uc.execute({});
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(repo.listPermissions).toHaveBeenCalledWith({ limit: 50, offset: 0 });
  });

  it('passes custom pagination to repo', async () => {
    const repo = makeRepo();
    const uc = new ListPermissionsUseCase(repo);
    await uc.execute({ limit: 5, offset: 10 });
    expect(repo.listPermissions).toHaveBeenCalledWith({ limit: 5, offset: 10 });
  });

  it('returns empty list when no permissions exist', async () => {
    const repo = makeRepo({ listPermissions: jest.fn().mockResolvedValue({ items: [], total: 0 }) });
    const uc = new ListPermissionsUseCase(repo);
    const result = await uc.execute({});
    expect(result.items).toHaveLength(0);
  });
});
