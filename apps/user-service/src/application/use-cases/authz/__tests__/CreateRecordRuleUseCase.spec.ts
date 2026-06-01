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

import { CreateRecordRuleUseCase } from '../CreateRecordRuleUseCase';
import { ValidationError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';
import type { IRecordRulesEventPublisher } from '../../../ports/IRecordRulesEventPublisher';

const validDomainExpression = {
  op: 'eq',
  field: 'userId',
  value: { $ctx: 'current_user.id' },
};

const invalidDomainExpression = {
  op: 'INVALID_OP',
  field: 'userId',
  value: 'test',
};

function makeRule(overrides: Record<string, any> = {}) {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    description: null,
    modelName: 'Order',
    groupId: null,
    mode: 'read',
    domainExpression: validDomainExpression,
    isActive: true,
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
    createRecordRule: jest.fn().mockResolvedValue(makeRule()),
    updateRecordRule: jest.fn(),
    deleteRecordRule: jest.fn(),
    ...overrides,
  } as IAuthzRepository;
}

function makePublisher(overrides: Partial<IRecordRulesEventPublisher> = {}): IRecordRulesEventPublisher {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('CreateRecordRuleUseCase', () => {
  it('creates rule and publishes event on happy path', async () => {
    const repo = makeRepo();
    const publisher = makePublisher();
    const useCase = new CreateRecordRuleUseCase(repo, publisher);

    const result = await useCase.execute({
      name: 'My Rule',
      modelName: 'Order',
      mode: 'read',
      domainExpression: validDomainExpression,
    });

    expect(result.id).toBe('rule-1');
    expect(repo.createRecordRule).toHaveBeenCalledTimes(1);
    // Fase 5.8: publisher now receives full rule snapshot (no top-level modelName).
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'rule.created',
        ruleId: 'rule-1',
        rule: expect.objectContaining({
          id: 'rule-1',
          modelName: 'Order',
          mode: 'read',
          isActive: true,
          groupCode: null,
        }),
      }),
    );
  });

  it('throws ValidationError for invalid domainExpression', async () => {
    const repo = makeRepo();
    const publisher = makePublisher();
    const useCase = new CreateRecordRuleUseCase(repo, publisher);

    await expect(
      useCase.execute({
        name: 'Bad Rule',
        modelName: 'Order',
        mode: 'read',
        domainExpression: invalidDomainExpression,
      }),
    ).rejects.toThrow(ValidationError);

    expect(repo.createRecordRule).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('does not throw when publisher fails — rule is still persisted', async () => {
    const repo = makeRepo();
    const publisher = makePublisher({
      publish: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
    });
    const useCase = new CreateRecordRuleUseCase(repo, publisher);

    const result = await useCase.execute({
      name: 'My Rule',
      modelName: 'Order',
      mode: 'read',
      domainExpression: validDomainExpression,
    });

    // Rule must be persisted despite publish failure.
    expect(result.id).toBe('rule-1');
    expect(repo.createRecordRule).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledTimes(1);
  });

  it('throws ValidationError for missing name', async () => {
    const repo = makeRepo();
    const publisher = makePublisher();
    const useCase = new CreateRecordRuleUseCase(repo, publisher);

    await expect(
      useCase.execute({
        name: '',
        modelName: 'Order',
        mode: 'read',
        domainExpression: validDomainExpression,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for missing modelName', async () => {
    const repo = makeRepo();
    const publisher = makePublisher();
    const useCase = new CreateRecordRuleUseCase(repo, publisher);

    await expect(
      useCase.execute({
        name: 'My Rule',
        modelName: '',
        mode: 'read',
        domainExpression: validDomainExpression,
      }),
    ).rejects.toThrow(ValidationError);
  });
});
