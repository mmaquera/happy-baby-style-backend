jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { ListRecordRulesUseCase } from '../ListRecordRulesUseCase';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { AuthRecordRuleEntity } from '../../../../domain/entities/Authz';

function makeRule(modelName = 'Order'): AuthRecordRuleEntity {
  return {
    id: `rule-${modelName}`,
    name: `Rule for ${modelName}`,
    description: null,
    modelName,
    groupId: 'g-1',
    mode: 'read',
    domainExpression: { op: 'eq', field: 'customerId', value: { $ctx: 'userId' } },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    listRecordRules: jest.fn().mockResolvedValue({ items: [makeRule()], total: 1 }),
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
    findImplication: jest.fn(),
    listGroupImplications: jest.fn(),
    addGroupImplication: jest.fn(),
    removeGroupImplication: jest.fn(),
    findRecordRuleById: jest.fn(),
    createRecordRule: jest.fn(),
    updateRecordRule: jest.fn(),
    deleteRecordRule: jest.fn(),
    ...overrides,
  } as IAuthzRepository;
}

describe('ListRecordRulesUseCase', () => {
  it('returns all rules with default pagination', async () => {
    const repo = makeRepo();
    const uc = new ListRecordRulesUseCase(repo);
    const result = await uc.execute({}, {});
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(repo.listRecordRules).toHaveBeenCalledWith({}, { limit: 50, offset: 0 });
  });

  it('passes modelName filter to repo', async () => {
    const repo = makeRepo();
    const uc = new ListRecordRulesUseCase(repo);
    await uc.execute({ modelName: 'Order' }, { limit: 10, offset: 0 });
    expect(repo.listRecordRules).toHaveBeenCalledWith({ modelName: 'Order' }, { limit: 10, offset: 0 });
  });

  it('returns empty list when no rules exist', async () => {
    const repo = makeRepo({ listRecordRules: jest.fn().mockResolvedValue({ items: [], total: 0 }) });
    const uc = new ListRecordRulesUseCase(repo);
    const result = await uc.execute({}, {});
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
