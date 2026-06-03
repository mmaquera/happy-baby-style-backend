jest.mock('@hbs/logging', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createUseCaseLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}), { virtual: true });

import { UpdateRecordRuleUseCase } from '../UpdateRecordRuleUseCase';
import { NotFoundError, ValidationError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { IRecordRulesEventPublisher } from '../../../ports/IRecordRulesEventPublisher';
import type { AuthRecordRuleEntity, AuthGroupEntity } from '../../../../domain/entities/Authz';

const validDomainExpression = { op: 'eq', field: 'customerId', value: { $ctx: 'userId' } };
const invalidDomainExpression = { op: 'UNKNOWN_OP', field: 'x', value: 'y' };

function makeRule(overrides: Partial<AuthRecordRuleEntity> = {}): AuthRecordRuleEntity {
  return {
    id: 'rule-1',
    name: 'Own Orders',
    description: null,
    modelName: 'Order',
    groupId: null,
    mode: 'read',
    domainExpression: { op: 'eq', field: 'customerId', value: { $ctx: 'userId' } },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeGroup(): AuthGroupEntity {
  return { id: 'g-1', code: 'customers', name: 'Customers', description: null, isSystem: false, createdAt: new Date(), updatedAt: new Date() };
}

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    findRecordRuleById: jest.fn().mockResolvedValue(makeRule()),
    updateRecordRule: jest.fn().mockResolvedValue(makeRule({ name: 'Updated Rule' })),
    findGroupById: jest.fn().mockResolvedValue(makeGroup()),
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
    deleteRecordRule: jest.fn(),
    ...overrides,
  } as IAuthzRepository;
}

function makePublisher(overrides: Partial<IRecordRulesEventPublisher> = {}): IRecordRulesEventPublisher {
  return { publish: jest.fn().mockResolvedValue(undefined), ...overrides };
}

describe('UpdateRecordRuleUseCase', () => {
  it('updates rule and publishes updated event', async () => {
    const repo = makeRepo();
    const publisher = makePublisher();
    const uc = new UpdateRecordRuleUseCase(repo, publisher);
    const result = await uc.execute('rule-1', { name: 'Updated Rule' });
    expect(result.id).toBe('rule-1');
    expect(repo.updateRecordRule).toHaveBeenCalledWith('rule-1', { name: 'Updated Rule' });
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'rule.updated', ruleId: 'rule-1' }),
    );
  });

  it('throws NotFoundError when rule does not exist', async () => {
    const repo = makeRepo({ findRecordRuleById: jest.fn().mockResolvedValue(null) });
    const uc = new UpdateRecordRuleUseCase(repo, makePublisher());
    await expect(uc.execute('rule-1', { name: 'X' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError for invalid domainExpression', async () => {
    const repo = makeRepo();
    const uc = new UpdateRecordRuleUseCase(repo, makePublisher());
    await expect(
      uc.execute('rule-1', { domainExpression: invalidDomainExpression }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.updateRecordRule).not.toHaveBeenCalled();
  });

  it('accepts valid domainExpression without throwing', async () => {
    const repo = makeRepo();
    const uc = new UpdateRecordRuleUseCase(repo, makePublisher());
    await expect(
      uc.execute('rule-1', { domainExpression: validDomainExpression }),
    ).resolves.toBeDefined();
  });

  it('does not throw when publish fails — rule update is committed', async () => {
    const repo = makeRepo();
    const publisher = makePublisher({ publish: jest.fn().mockRejectedValue(new Error('Redis down')) });
    const uc = new UpdateRecordRuleUseCase(repo, publisher);
    const result = await uc.execute('rule-1', { name: 'Updated' });
    expect(result).toBeDefined();
    expect(repo.updateRecordRule).toHaveBeenCalled();
  });

  it('resolves groupCode when rule has a groupId', async () => {
    const repo = makeRepo({
      updateRecordRule: jest.fn().mockResolvedValue(makeRule({ groupId: 'g-1' })),
    });
    const publisher = makePublisher();
    const uc = new UpdateRecordRuleUseCase(repo, publisher);
    await uc.execute('rule-1', { name: 'X' });
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ rule: expect.objectContaining({ groupCode: 'customers' }) }),
    );
  });
});
