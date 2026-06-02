import { type PrismaClient, type RecordRuleMode, Prisma } from '../../prisma';
import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type {
  IAuthzRepository,
  PaginationInput,
} from '../../domain/repositories/IAuthzRepository';
import type {
  AuthGroupEntity,
  AuthPermissionEntity,
  GroupPermissionEntity,
  GroupImplicationEntity,
  UserGroupEntity,
  AuthRecordRuleEntity,
  RecordRuleModeValue,
} from '../../domain/entities/Authz';

// ---------------------------------------------------------------------------
// Internal Prisma result shapes — kept private to this file.
// ---------------------------------------------------------------------------

type PrismaAuthGroup = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaAuthPermission = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaGroupPermission = {
  groupId: string;
  permissionId: string;
  createdAt: Date;
};

type PrismaGroupImplication = {
  groupId: string;
  impliedGroupId: string;
  createdAt: Date;
};

type PrismaUserGroup = {
  userId: string;
  groupId: string;
  grantedAt: Date;
  grantedBy: string | null;
};

type PrismaAuthRecordRule = {
  id: string;
  name: string;
  description: string | null;
  modelName: string;
  groupId: string | null;
  mode: RecordRuleMode;
  domainExpression: Prisma.JsonValue;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Mappers — Prisma result → domain entity
// Each mapper is a pure function so it can be unit-tested in isolation.
// ---------------------------------------------------------------------------

function toAuthGroup(p: PrismaAuthGroup): AuthGroupEntity {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    isSystem: p.isSystem,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toAuthPermission(p: PrismaAuthPermission): AuthPermissionEntity {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    category: p.category,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toGroupPermission(p: PrismaGroupPermission): GroupPermissionEntity {
  return {
    groupId: p.groupId,
    permissionId: p.permissionId,
    createdAt: p.createdAt,
  };
}

function toGroupImplication(p: PrismaGroupImplication): GroupImplicationEntity {
  return {
    groupId: p.groupId,
    impliedGroupId: p.impliedGroupId,
    createdAt: p.createdAt,
  };
}

function toUserGroup(p: PrismaUserGroup): UserGroupEntity {
  return {
    userId: p.userId,
    groupId: p.groupId,
    grantedAt: p.grantedAt,
    grantedBy: p.grantedBy,
  };
}

function toRecordRule(p: PrismaAuthRecordRule): AuthRecordRuleEntity {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    modelName: p.modelName,
    groupId: p.groupId,
    // Prisma's RecordRuleMode enum values are identical to RecordRuleModeValue strings.
    mode: p.mode as RecordRuleModeValue,
    // Prisma.JsonValue is stored verbatim — the domain treats this as opaque `unknown`
    // and the application layer (CreateRecordRuleUseCase) validates it via DomainExprSchema.
    domainExpression: p.domainExpression as unknown,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export class PrismaAuthzRepository implements IAuthzRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaAuthzRepository');
  }

  // ── Groups ──────────────────────────────────────────────────────────────────

  async findGroupById(id: string): Promise<AuthGroupEntity | null> {
    const row = await this.prisma.authGroup.findUnique({ where: { id } });
    return row ? toAuthGroup(row) : null;
  }

  async findGroupByCode(code: string): Promise<AuthGroupEntity | null> {
    const row = await this.prisma.authGroup.findUnique({ where: { code } });
    return row ? toAuthGroup(row) : null;
  }

  async listGroups(pagination: PaginationInput): Promise<{ items: AuthGroupEntity[]; total: number }> {
    const limit = pagination.limit ?? 50;
    const offset = pagination.offset ?? 0;
    const [rows, total] = await Promise.all([
      this.prisma.authGroup.findMany({
        skip: offset,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prisma.authGroup.count(),
    ]);
    return { items: rows.map(toAuthGroup), total };
  }

  async createGroup(input: {
    code: string;
    name: string;
    description?: string;
  }): Promise<AuthGroupEntity> {
    const row = await this.prisma.authGroup.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
      },
    });
    return toAuthGroup(row);
  }

  async updateGroup(
    id: string,
    input: { name?: string; description?: string },
  ): Promise<AuthGroupEntity> {
    const row = await this.prisma.authGroup.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
    return toAuthGroup(row);
  }

  async deleteGroup(id: string): Promise<void> {
    await this.prisma.authGroup.delete({ where: { id } });
  }

  async countGroupRelations(id: string): Promise<{
    users: number;
    permissions: number;
    implications: number;
    recordRules: number;
  }> {
    const [users, permissions, implications, recordRules] = await Promise.all([
      this.prisma.userGroup.count({ where: { groupId: id } }),
      this.prisma.groupPermission.count({ where: { groupId: id } }),
      // Count only where this group is the PARENT (groupId=id).
      // When a group is only referenced as a child (impliedGroupId=id), the DB
      // cascades that row on delete automatically — blocking on it would prevent
      // deleting leaf groups that happen to be implied by others.
      this.prisma.groupImplication.count({ where: { groupId: id } }),
      this.prisma.authRecordRule.count({ where: { groupId: id } }),
    ]);
    return { users, permissions, implications, recordRules };
  }

  // ── Permissions ──────────────────────────────────────────────────────────────

  async findPermissionById(id: string): Promise<AuthPermissionEntity | null> {
    const row = await this.prisma.authPermission.findUnique({ where: { id } });
    return row ? toAuthPermission(row) : null;
  }

  async findPermissionByCode(code: string): Promise<AuthPermissionEntity | null> {
    const row = await this.prisma.authPermission.findUnique({ where: { code } });
    return row ? toAuthPermission(row) : null;
  }

  async listPermissions(
    pagination: PaginationInput,
  ): Promise<{ items: AuthPermissionEntity[]; total: number }> {
    const limit = pagination.limit ?? 50;
    const offset = pagination.offset ?? 0;
    const [rows, total] = await Promise.all([
      this.prisma.authPermission.findMany({
        skip: offset,
        take: limit,
        orderBy: [{ category: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.authPermission.count(),
    ]);
    return { items: rows.map(toAuthPermission), total };
  }

  async createPermission(input: {
    code: string;
    name: string;
    description?: string;
    category: string;
  }): Promise<AuthPermissionEntity> {
    const row = await this.prisma.authPermission.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        category: input.category,
      },
    });
    return toAuthPermission(row);
  }

  async updatePermission(
    id: string,
    input: { name?: string; description?: string; category?: string },
  ): Promise<AuthPermissionEntity> {
    const row = await this.prisma.authPermission.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
      },
    });
    return toAuthPermission(row);
  }

  async deletePermission(id: string): Promise<void> {
    await this.prisma.authPermission.delete({ where: { id } });
  }

  async countPermissionUsage(id: string): Promise<number> {
    return this.prisma.groupPermission.count({ where: { permissionId: id } });
  }

  // ── UserGroup memberships ───────────────────────────────────────────────────

  async findUserGroup(userId: string, groupId: string): Promise<UserGroupEntity | null> {
    const row = await this.prisma.userGroup.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    return row ? toUserGroup(row) : null;
  }

  async listUserGroups(userId: string): Promise<UserGroupEntity[]> {
    const rows = await this.prisma.userGroup.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
    });
    return rows.map(toUserGroup);
  }

  async assignUserToGroup(input: {
    userId: string;
    groupId: string;
    grantedBy?: string;
  }): Promise<UserGroupEntity> {
    try {
      const row = await this.prisma.userGroup.create({
        data: {
          userId: input.userId,
          groupId: input.groupId,
          grantedBy: input.grantedBy ?? null,
        },
      });
      return toUserGroup(row);
    } catch (err) {
      // P2003: FK constraint violation — userId does not exist in user_profiles.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new NotFoundError('User', input.userId);
      }
      throw err;
    }
  }

  async removeUserFromGroup(userId: string, groupId: string): Promise<void> {
    await this.prisma.userGroup.delete({
      where: { userId_groupId: { userId, groupId } },
    });
  }

  // ── Group permissions ───────────────────────────────────────────────────────

  async findGroupPermission(groupId: string, permissionId: string): Promise<GroupPermissionEntity | null> {
    const row = await this.prisma.groupPermission.findUnique({
      where: { groupId_permissionId: { groupId, permissionId } },
    });
    return row ? toGroupPermission(row) : null;
  }

  async listGroupPermissions(groupId: string): Promise<GroupPermissionEntity[]> {
    const rows = await this.prisma.groupPermission.findMany({
      where: { groupId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toGroupPermission);
  }

  async assignPermissionToGroup(groupId: string, permissionId: string): Promise<GroupPermissionEntity> {
    const row = await this.prisma.groupPermission.create({
      data: { groupId, permissionId },
    });
    return toGroupPermission(row);
  }

  async revokePermissionFromGroup(groupId: string, permissionId: string): Promise<void> {
    await this.prisma.groupPermission.delete({
      where: { groupId_permissionId: { groupId, permissionId } },
    });
  }

  // ── Group implications ───────────────────────────────────────────────────────

  async findImplication(groupId: string, impliedGroupId: string): Promise<GroupImplicationEntity | null> {
    const row = await this.prisma.groupImplication.findUnique({
      where: { groupId_impliedGroupId: { groupId, impliedGroupId } },
    });
    return row ? toGroupImplication(row) : null;
  }

  async listGroupImplications(): Promise<GroupImplicationEntity[]> {
    const rows = await this.prisma.groupImplication.findMany();
    return rows.map(toGroupImplication);
  }

  async addGroupImplication(groupId: string, impliedGroupId: string): Promise<GroupImplicationEntity> {
    const row = await this.prisma.groupImplication.create({
      data: { groupId, impliedGroupId },
    });
    return toGroupImplication(row);
  }

  async removeGroupImplication(groupId: string, impliedGroupId: string): Promise<void> {
    await this.prisma.groupImplication.delete({
      where: { groupId_impliedGroupId: { groupId, impliedGroupId } },
    });
  }

  // ── Record rules ─────────────────────────────────────────────────────────────

  async findRecordRuleById(id: string): Promise<AuthRecordRuleEntity | null> {
    const row = await this.prisma.authRecordRule.findUnique({ where: { id } });
    return row ? toRecordRule(row) : null;
  }

  async listRecordRules(
    filter: { modelName?: string },
    pagination: PaginationInput,
  ): Promise<{ items: AuthRecordRuleEntity[]; total: number }> {
    const limit = pagination.limit ?? 50;
    const offset = pagination.offset ?? 0;
    const where = filter.modelName ? { modelName: filter.modelName } : {};
    const [rows, total] = await Promise.all([
      this.prisma.authRecordRule.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ modelName: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.authRecordRule.count({ where }),
    ]);
    return { items: rows.map(toRecordRule), total };
  }

  async createRecordRule(input: {
    name: string;
    description?: string;
    modelName: string;
    groupId?: string;
    mode: RecordRuleModeValue;
    domainExpression: unknown;
    isActive: boolean;
  }): Promise<AuthRecordRuleEntity> {
    const row = await this.prisma.authRecordRule.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        modelName: input.modelName,
        groupId: input.groupId ?? null,
        mode: input.mode as RecordRuleMode,
        domainExpression: input.domainExpression as Prisma.InputJsonValue,
        isActive: input.isActive,
      },
    });
    return toRecordRule(row);
  }

  async updateRecordRule(
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
  ): Promise<AuthRecordRuleEntity> {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data['name'] = input.name;
    if (input.description !== undefined) data['description'] = input.description;
    if (input.modelName !== undefined) data['modelName'] = input.modelName;
    if ('groupId' in input) data['groupId'] = input.groupId;
    if (input.mode !== undefined) data['mode'] = input.mode as RecordRuleMode;
    if (input.domainExpression !== undefined) data['domainExpression'] = input.domainExpression;
    if (input.isActive !== undefined) data['isActive'] = input.isActive;

    const row = await this.prisma.authRecordRule.update({
      where: { id },
      data: data as Parameters<typeof this.prisma.authRecordRule.update>[0]['data'],
    });
    return toRecordRule(row);
  }

  async deleteRecordRule(id: string): Promise<void> {
    await this.prisma.authRecordRule.delete({ where: { id } });
  }
}
