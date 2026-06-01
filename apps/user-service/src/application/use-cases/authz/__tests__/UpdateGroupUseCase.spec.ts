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

import { UpdateGroupUseCase } from '../UpdateGroupUseCase';
import { NotFoundError } from '@hbs/shared-kernel';
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
    updateGroup: jest.fn().mockImplementation((_id, input) =>
      Promise.resolve({ ...makeGroup(), ...input }),
    ),
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

describe('UpdateGroupUseCase', () => {
  it('updates name and description for normal group', async () => {
    const repo = makeRepo();
    const useCase = new UpdateGroupUseCase(repo);
    await useCase.execute('g-1', { name: 'Senior Editors', description: 'Updated desc' });
    expect(repo.updateGroup).toHaveBeenCalledWith('g-1', {
      name: 'Senior Editors',
      description: 'Updated desc',
    });
  });

  it('throws NotFoundError when group does not exist', async () => {
    const repo = makeRepo({ findGroupById: jest.fn().mockResolvedValue(null) });
    const useCase = new UpdateGroupUseCase(repo);
    await expect(useCase.execute('missing', { name: 'Test' })).rejects.toThrow(NotFoundError);
  });

  it('skips name update for system group but allows description update', async () => {
    const repo = makeRepo({
      findGroupById: jest.fn().mockResolvedValue(makeGroup({ isSystem: true })),
    });
    const useCase = new UpdateGroupUseCase(repo);
    await useCase.execute('g-1', { name: 'Should Be Ignored', description: 'New desc' });
    // name should NOT be in the payload — updateGroup called without name
    const callArgs = (repo.updateGroup as jest.Mock).mock.calls[0];
    expect(callArgs[1]).not.toHaveProperty('name');
    expect(callArgs[1]).toHaveProperty('description', 'New desc');
  });
});
