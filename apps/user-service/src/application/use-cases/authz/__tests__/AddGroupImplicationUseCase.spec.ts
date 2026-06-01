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

import { AddGroupImplicationUseCase } from '../AddGroupImplicationUseCase';
import { NotFoundError, ValidationError, BusinessLogicError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';

function makeGroup(id: string, code: string) {
  return { id, code, name: code, description: null, isSystem: false, createdAt: new Date(), updatedAt: new Date() };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    findGroupById: jest.fn().mockImplementation((id: string) => {
      const groups: Record<string, any> = {
        'g-a': makeGroup('g-a', 'group-a'),
        'g-b': makeGroup('g-b', 'group-b'),
        'g-c': makeGroup('g-c', 'group-c'),
      };
      return Promise.resolve(groups[id] ?? null);
    }),
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
    findImplication: jest.fn().mockResolvedValue(null),
    listGroupImplications: jest.fn().mockResolvedValue([]),
    addGroupImplication: jest.fn().mockImplementation((groupId: string, impliedGroupId: string) =>
      Promise.resolve({ groupId, impliedGroupId, createdAt: new Date() }),
    ),
    removeGroupImplication: jest.fn(),
    findRecordRuleById: jest.fn(),
    listRecordRules: jest.fn(),
    createRecordRule: jest.fn(),
    updateRecordRule: jest.fn(),
    deleteRecordRule: jest.fn(),
    ...overrides,
  } as IAuthzRepository;
}

describe('AddGroupImplicationUseCase', () => {
  it('happy path — adds implication when no cycle', async () => {
    const repo = makeRepo();
    const useCase = new AddGroupImplicationUseCase(repo);
    const result = await useCase.execute({ groupId: 'g-a', impliedGroupId: 'g-b' });
    expect(result.groupId).toBe('g-a');
    expect(result.impliedGroupId).toBe('g-b');
    expect(repo.addGroupImplication).toHaveBeenCalledWith('g-a', 'g-b');
  });

  it('throws ValidationError for self-implication (groupId === impliedGroupId)', async () => {
    const repo = makeRepo();
    const useCase = new AddGroupImplicationUseCase(repo);
    await expect(useCase.execute({ groupId: 'g-a', impliedGroupId: 'g-a' })).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError when groupId does not exist', async () => {
    const repo = makeRepo({
      findGroupById: jest.fn().mockResolvedValue(null),
    });
    const useCase = new AddGroupImplicationUseCase(repo);
    await expect(useCase.execute({ groupId: 'missing', impliedGroupId: 'g-b' })).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when impliedGroupId does not exist', async () => {
    const repo = makeRepo({
      findGroupById: jest.fn().mockImplementation((id: string) =>
        id === 'g-a' ? Promise.resolve(makeGroup('g-a', 'group-a')) : Promise.resolve(null),
      ),
    });
    const useCase = new AddGroupImplicationUseCase(repo);
    await expect(useCase.execute({ groupId: 'g-a', impliedGroupId: 'missing' })).rejects.toThrow(NotFoundError);
  });

  it('detects direct cycle A→B + B→A', async () => {
    // Existing: B→A. Adding A→B would create a cycle.
    const repo = makeRepo({
      listGroupImplications: jest.fn().mockResolvedValue([
        { groupId: 'g-b', impliedGroupId: 'g-a' },
      ]),
    });
    const useCase = new AddGroupImplicationUseCase(repo);
    await expect(useCase.execute({ groupId: 'g-a', impliedGroupId: 'g-b' })).rejects.toThrow(BusinessLogicError);
  });

  it('detects indirect cycle A→B + B→C + C→A', async () => {
    // Existing: B→C, C→A. Adding A→B would create A→B→C→A.
    const repo = makeRepo({
      listGroupImplications: jest.fn().mockResolvedValue([
        { groupId: 'g-b', impliedGroupId: 'g-c' },
        { groupId: 'g-c', impliedGroupId: 'g-a' },
      ]),
    });
    const useCase = new AddGroupImplicationUseCase(repo);
    await expect(useCase.execute({ groupId: 'g-a', impliedGroupId: 'g-b' })).rejects.toThrow(BusinessLogicError);
  });

  it('returns existing implication idempotently', async () => {
    const existing = { groupId: 'g-a', impliedGroupId: 'g-b', createdAt: new Date() };
    const repo = makeRepo({
      findImplication: jest.fn().mockResolvedValue(existing),
    });
    const useCase = new AddGroupImplicationUseCase(repo);
    const result = await useCase.execute({ groupId: 'g-a', impliedGroupId: 'g-b' });
    expect(result).toBe(existing);
    expect(repo.addGroupImplication).not.toHaveBeenCalled();
  });
});
