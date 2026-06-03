jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { DeleteRecordRuleUseCase } from '../DeleteRecordRuleUseCase';
import { NotFoundError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { IRecordRulesEventPublisher } from '../../../ports/IRecordRulesEventPublisher';
import type { AuthRecordRuleEntity } from '../../../../domain/entities/Authz';

function makeRule(overrides: Partial<AuthRecordRuleEntity> = {}): AuthRecordRuleEntity {
  return {
    id: 'rule-1',
    name: 'Own Orders Only',
    description: null,
    modelName: 'Order',
    groupId: 'g-1',
    mode: 'read',
    domainExpression: { op: 'eq', field: 'customerId', value: { $ctx: 'userId' } },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    findRecordRuleById: jest.fn().mockResolvedValue(makeRule()),
    deleteRecordRule: jest.fn().mockResolvedValue(undefined),
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
    listRecordRules: jest.fn(),
    createRecordRule: jest.fn(),
    updateRecordRule: jest.fn(),
    ...overrides,
  } as IAuthzRepository;
}

function makePublisher(overrides: Partial<IRecordRulesEventPublisher> = {}): IRecordRulesEventPublisher {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('DeleteRecordRuleUseCase', () => {
  it('deletes rule and publishes deleted event', async () => {
    const repo = makeRepo();
    const publisher = makePublisher();
    const uc = new DeleteRecordRuleUseCase(repo, publisher);
    await uc.execute('rule-1');
    expect(repo.deleteRecordRule).toHaveBeenCalledWith('rule-1');
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'rule.deleted', ruleId: 'rule-1', rule: null }),
    );
  });

  it('throws NotFoundError when rule does not exist', async () => {
    const repo = makeRepo({ findRecordRuleById: jest.fn().mockResolvedValue(null) });
    const uc = new DeleteRecordRuleUseCase(repo, makePublisher());
    await expect(uc.execute('rule-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('logs error and continues when publish fails (cache may be stale)', async () => {
    const repo = makeRepo();
    const publisher = makePublisher({ publish: jest.fn().mockRejectedValue(new Error('Redis down')) });
    const uc = new DeleteRecordRuleUseCase(repo, publisher);
    // Should not throw — publish failure is logged, not propagated
    await expect(uc.execute('rule-1')).resolves.toBeUndefined();
    expect(repo.deleteRecordRule).toHaveBeenCalled();
  });
});
