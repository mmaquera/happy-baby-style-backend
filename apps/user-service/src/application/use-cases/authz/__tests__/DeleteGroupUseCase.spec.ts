jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    }),
  },
}), { virtual: true });

import { DeleteGroupUseCase } from '../DeleteGroupUseCase';
import { NotFoundError, BusinessLogicError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';

function makeGroup(overrides: Record<string, any> = {}) {
  return {
    id: 'g-1',
    code: 'editors',
    name: 'Editors',
    description: null,
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    findGroupById: jest.fn().mockResolvedValue(makeGroup()),
    findGroupByCode: jest.fn(),
    listGroups: jest.fn(),
    createGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn().mockResolvedValue(undefined),
    countGroupRelations: jest.fn().mockResolvedValue({ users: 0, permissions: 0, implications: 0, recordRules: 0 }),
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

describe('DeleteGroupUseCase', () => {
  it('deletes a group with no relations', async () => {
    const repo = makeRepo();
    const useCase = new DeleteGroupUseCase(repo);
    await useCase.execute('g-1');
    expect(repo.deleteGroup).toHaveBeenCalledWith('g-1');
  });

  it('throws NotFoundError when group does not exist', async () => {
    const repo = makeRepo({ findGroupById: jest.fn().mockResolvedValue(null) });
    const useCase = new DeleteGroupUseCase(repo);
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessLogicError when group is_system=true', async () => {
    const repo = makeRepo({
      findGroupById: jest.fn().mockResolvedValue(makeGroup({ isSystem: true })),
    });
    const useCase = new DeleteGroupUseCase(repo);
    await expect(useCase.execute('g-1')).rejects.toThrow(BusinessLogicError);
  });

  it('throws BusinessLogicError when group has users', async () => {
    const repo = makeRepo({
      countGroupRelations: jest.fn().mockResolvedValue({
        users: 2, permissions: 0, implications: 0, recordRules: 0,
      }),
    });
    const useCase = new DeleteGroupUseCase(repo);
    await expect(useCase.execute('g-1')).rejects.toThrow(BusinessLogicError);
  });

  it('throws BusinessLogicError when group has permissions', async () => {
    const repo = makeRepo({
      countGroupRelations: jest.fn().mockResolvedValue({
        users: 0, permissions: 3, implications: 0, recordRules: 0,
      }),
    });
    const useCase = new DeleteGroupUseCase(repo);
    await expect(useCase.execute('g-1')).rejects.toThrow(BusinessLogicError);
  });
});
