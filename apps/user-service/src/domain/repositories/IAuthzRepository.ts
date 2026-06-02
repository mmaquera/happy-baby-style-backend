import type {
  AuthGroupEntity,
  AuthPermissionEntity,
  GroupPermissionEntity,
  GroupImplicationEntity,
  UserGroupEntity,
  AuthRecordRuleEntity,
  RecordRuleModeValue,
} from '../entities/Authz';

export interface PaginationInput {
  limit?: number; // default 50
  offset?: number; // default 0
}

export interface IAuthzRepository {
  // Groups
  findGroupById(id: string): Promise<AuthGroupEntity | null>;
  findGroupByCode(code: string): Promise<AuthGroupEntity | null>;
  listGroups(pagination: PaginationInput): Promise<{ items: AuthGroupEntity[]; total: number }>;
  createGroup(input: { code: string; name: string; description?: string }): Promise<AuthGroupEntity>;
  updateGroup(id: string, input: { name?: string; description?: string }): Promise<AuthGroupEntity>;
  deleteGroup(id: string): Promise<void>;
  countGroupRelations(id: string): Promise<{
    users: number;
    permissions: number;
    implications: number;
    recordRules: number;
  }>;

  // Permissions
  findPermissionById(id: string): Promise<AuthPermissionEntity | null>;
  findPermissionByCode(code: string): Promise<AuthPermissionEntity | null>;
  listPermissions(pagination: PaginationInput): Promise<{ items: AuthPermissionEntity[]; total: number }>;
  createPermission(input: {
    code: string;
    name: string;
    description?: string;
    category: string;
  }): Promise<AuthPermissionEntity>;
  updatePermission(
    id: string,
    input: { name?: string; description?: string; category?: string },
  ): Promise<AuthPermissionEntity>;
  deletePermission(id: string): Promise<void>;
  countPermissionUsage(id: string): Promise<number>;

  // UserGroup memberships
  findUserGroup(userId: string, groupId: string): Promise<UserGroupEntity | null>;
  listUserGroups(userId: string): Promise<UserGroupEntity[]>;
  assignUserToGroup(input: {
    userId: string;
    groupId: string;
    grantedBy?: string;
  }): Promise<UserGroupEntity>;
  removeUserFromGroup(userId: string, groupId: string): Promise<void>;

  // Group permissions
  findGroupPermission(groupId: string, permissionId: string): Promise<GroupPermissionEntity | null>;
  listGroupPermissions(groupId: string): Promise<GroupPermissionEntity[]>;
  assignPermissionToGroup(groupId: string, permissionId: string): Promise<GroupPermissionEntity>;
  revokePermissionFromGroup(groupId: string, permissionId: string): Promise<void>;

  // Group implications (inheritance)
  findImplication(groupId: string, impliedGroupId: string): Promise<GroupImplicationEntity | null>;
  listGroupImplications(): Promise<GroupImplicationEntity[]>;
  addGroupImplication(groupId: string, impliedGroupId: string): Promise<GroupImplicationEntity>;
  removeGroupImplication(groupId: string, impliedGroupId: string): Promise<void>;

  // Record rules
  findRecordRuleById(id: string): Promise<AuthRecordRuleEntity | null>;
  listRecordRules(
    filter: { modelName?: string },
    pagination: PaginationInput,
  ): Promise<{ items: AuthRecordRuleEntity[]; total: number }>;
  createRecordRule(input: {
    name: string;
    description?: string;
    modelName: string;
    groupId?: string;
    mode: RecordRuleModeValue;
    domainExpression: unknown;
    isActive: boolean;
  }): Promise<AuthRecordRuleEntity>;
  updateRecordRule(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      modelName: string;
      groupId: string | null;
      mode: RecordRuleModeValue;
      domainExpression: unknown;
      isActive: boolean;
    }>,
  ): Promise<AuthRecordRuleEntity>;
  deleteRecordRule(id: string): Promise<void>;
}
