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

import { CreateGroupUseCase } from '../CreateGroupUseCase';
import { ValidationError } from '@hbs/shared-kernel';
import type { IAuthzRepository } from '../../../../domain/repositories/IAuthzRepository';

function makeRepo(overrides: Partial<IAuthzRepository> = {}): IAuthzRepository {
  return {
    findGroupById: jest.fn(),
    findGroupByCode: jest.fn().mockResolvedValue(null),
    listGroups: jest.fn(),
    createGroup: jest.fn().mockResolvedValue({
      id: 'g-1',
      code: 'test-group',
      name: 'Test Group',
      description: null,
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
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
    createRecordRule: jest.fn(),
    updateRecordRule: jest.fn(),
    deleteRecordRule: jest.fn(),
    ...overrides,
  } as IAuthzRepository;
}

describe('CreateGroupUseCase', () => {
  it('creates a group with valid input', async () => {
    const repo = makeRepo();
    const useCase = new CreateGroupUseCase(repo);
    const result = await useCase.execute({ code: 'test-group', name: 'Test Group' });
    expect(result.code).toBe('test-group');
    expect(repo.createGroup).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'test-group', name: 'Test Group' }),
    );
  });

  it('throws ValidationError for invalid code (uppercase)', async () => {
    const repo = makeRepo();
    const useCase = new CreateGroupUseCase(repo);
    await expect(useCase.execute({ code: 'TestGroup', name: 'Test' })).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for code starting with digit', async () => {
    const repo = makeRepo();
    const useCase = new CreateGroupUseCase(repo);
    await expect(useCase.execute({ code: '1invalid', name: 'Bad' })).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when code already exists', async () => {
    const repo = makeRepo({
      findGroupByCode: jest.fn().mockResolvedValue({ id: 'g-existing', code: 'test-group' }),
    });
    const useCase = new CreateGroupUseCase(repo);
    await expect(useCase.execute({ code: 'test-group', name: 'Duplicate' })).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for empty name', async () => {
    const repo = makeRepo();
    const useCase = new CreateGroupUseCase(repo);
    await expect(useCase.execute({ code: 'valid-code', name: '' })).rejects.toThrow(ValidationError);
  });
});
