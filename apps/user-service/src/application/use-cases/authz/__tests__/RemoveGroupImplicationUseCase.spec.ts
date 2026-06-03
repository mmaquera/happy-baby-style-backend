jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { RemoveGroupImplicationUseCase } from '../RemoveGroupImplicationUseCase';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { GroupImplicationEntity } from '../../../../domain/entities/Authz';

function makeImplication(): GroupImplicationEntity {
  return { groupId: 'g-1', impliedGroupId: 'g-2', createdAt: new Date() };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    findImplication: jest.fn().mockResolvedValue(makeImplication()),
    removeGroupImplication: jest.fn().mockResolvedValue(undefined),
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
    findGroupPermission: jest.fn(),
    listGroupPermissions: jest.fn(),
    assignPermissionToGroup: jest.fn(),
    revokePermissionFromGroup: jest.fn(),
    listGroupImplications: jest.fn(),
    addGroupImplication: jest.fn(),
    findRecordRuleById: jest.fn(),
    listRecordRules: jest.fn(),
    createRecordRule: jest.fn(),
    updateRecordRule: jest.fn(),
    deleteRecordRule: jest.fn(),
    ...overrides,
  } as IAuthzRepository;
}

describe('RemoveGroupImplicationUseCase', () => {
  it('removes group implication successfully', async () => {
    const repo = makeRepo();
    const uc = new RemoveGroupImplicationUseCase(repo);
    await uc.execute('g-1', 'g-2');
    expect(repo.removeGroupImplication).toHaveBeenCalledWith('g-1', 'g-2');
  });

  it('throws NotFoundError when implication does not exist', async () => {
    const repo = makeRepo({ findImplication: jest.fn().mockResolvedValue(null) });
    const uc = new RemoveGroupImplicationUseCase(repo);
    await expect(uc.execute('g-1', 'g-2')).rejects.toBeInstanceOf(NotFoundError);
  });
});
