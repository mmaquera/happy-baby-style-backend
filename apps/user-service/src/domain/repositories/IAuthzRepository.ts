import type {
  AuthGroup,
  AuthPermission,
  GroupPermission,
  GroupImplication,
  UserGroup,
  AuthRecordRule,
} from '@prisma/client';

export interface PaginationInput {
  limit?: number; // default 50
  offset?: number; // default 0
}

export interface IAuthzRepository {
  // Groups
  findGroupById(id: string): Promise<AuthGroup | null>;
  findGroupByCode(code: string): Promise<AuthGroup | null>;
  listGroups(pagination: PaginationInput): Promise<{ items: AuthGroup[]; total: number }>;
  createGroup(input: { code: string; name: string; description?: string }): Promise<AuthGroup>;
  updateGroup(id: string, input: { name?: string; description?: string }): Promise<AuthGroup>;
  deleteGroup(id: string): Promise<void>;
  countGroupRelations(id: string): Promise<{
    users: number;
    permissions: number;
    implications: number;
    recordRules: number;
  }>;

  // Permissions
  findPermissionById(id: string): Promise<AuthPermission | null>;
  findPermissionByCode(code: string): Promise<AuthPermission | null>;
  listPermissions(pagination: PaginationInput): Promise<{ items: AuthPermission[]; total: number }>;
  createPermission(input: {
    code: string;
    name: string;
    description?: string;
    category: string;
  }): Promise<AuthPermission>;
  updatePermission(
    id: string,
    input: { name?: string; description?: string; category?: string },
  ): Promise<AuthPermission>;
  deletePermission(id: string): Promise<void>;
  countPermissionUsage(id: string): Promise<number>;

  // UserGroup memberships
  findUserGroup(userId: string, groupId: string): Promise<UserGroup | null>;
  listUserGroups(userId: string): Promise<UserGroup[]>;
  assignUserToGroup(input: {
    userId: string;
    groupId: string;
    grantedBy?: string;
  }): Promise<UserGroup>;
  removeUserFromGroup(userId: string, groupId: string): Promise<void>;

  // Group permissions
  findGroupPermission(groupId: string, permissionId: string): Promise<GroupPermission | null>;
  listGroupPermissions(groupId: string): Promise<GroupPermission[]>;
  assignPermissionToGroup(groupId: string, permissionId: string): Promise<GroupPermission>;
  revokePermissionFromGroup(groupId: string, permissionId: string): Promise<void>;

  // Group implications (inheritance)
  findImplication(groupId: string, impliedGroupId: string): Promise<GroupImplication | null>;
  listGroupImplications(): Promise<GroupImplication[]>;
  addGroupImplication(groupId: string, impliedGroupId: string): Promise<GroupImplication>;
  removeGroupImplication(groupId: string, impliedGroupId: string): Promise<void>;

  // Record rules
  findRecordRuleById(id: string): Promise<AuthRecordRule | null>;
  listRecordRules(
    filter: { modelName?: string },
    pagination: PaginationInput,
  ): Promise<{ items: AuthRecordRule[]; total: number }>;
  createRecordRule(input: {
    name: string;
    description?: string;
    modelName: string;
    groupId?: string;
    mode: 'read' | 'write' | 'create' | 'unlink';
    domainExpression: unknown;
    isActive: boolean;
  }): Promise<AuthRecordRule>;
  updateRecordRule(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      modelName: string;
      groupId: string | null;
      mode: 'read' | 'write' | 'create' | 'unlink';
      domainExpression: unknown;
      isActive: boolean;
    }>,
  ): Promise<AuthRecordRule>;
  deleteRecordRule(id: string): Promise<void>;
}
