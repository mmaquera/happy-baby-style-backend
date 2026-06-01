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

import { DeletePermissionUseCase } from '../DeletePermissionUseCase';
import { NotFoundError, BusinessLogicError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';

function makePermission(overrides: Record<string, any> = {}) {
  return {
    id: 'p-1',
    code: 'create:product',
    name: 'Create Product',
    description: null,
    category: 'product',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    findGroupById: jest.fn(),
    findGroupByCode: jest.fn(),
    listGroups: jest.fn(),
    createGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
    countGroupRelations: jest.fn(),
    findPermissionById: jest.fn().mockResolvedValue(makePermission()),
    findPermissionByCode: jest.fn(),
    listPermissions: jest.fn(),
    createPermission: jest.fn(),
    updatePermission: jest.fn(),
    deletePermission: jest.fn().mockResolvedValue(undefined),
    countPermissionUsage: jest.fn().mockResolvedValue(0),
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

describe('DeletePermissionUseCase', () => {
  it('deletes permission when not in use', async () => {
    const repo = makeRepo();
    const useCase = new DeletePermissionUseCase(repo);
    await useCase.execute('p-1');
    expect(repo.deletePermission).toHaveBeenCalledWith('p-1');
  });

  it('throws NotFoundError when permission does not exist', async () => {
    const repo = makeRepo({ findPermissionById: jest.fn().mockResolvedValue(null) });
    const useCase = new DeletePermissionUseCase(repo);
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessLogicError when permission has group assignments', async () => {
    const repo = makeRepo({ countPermissionUsage: jest.fn().mockResolvedValue(3) });
    const useCase = new DeletePermissionUseCase(repo);
    await expect(useCase.execute('p-1')).rejects.toThrow(BusinessLogicError);
  });
});
