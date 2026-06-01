import { type PrismaClient, type RecordRuleMode, Prisma } from '@prisma/client';
import { LoggerFactory, type ILogger } from '@hbs/logging';
import { NotFoundError } from '@hbs/shared-kernel';
import type {
  IAuthzRepository,
  PaginationInput,
} from '../../domain/repositories/IAuthzRepository';
import type {
  AuthGroup,
  AuthPermission,
  GroupPermission,
  GroupImplication,
  UserGroup,
  AuthRecordRule,
} from '@prisma/client';

export class PrismaAuthzRepository implements IAuthzRepository {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createRepositoryLogger('PrismaAuthzRepository');
  }

  // ── Groups ──────────────────────────────────────────────────────────────────

  async findGroupById(id: string): Promise<AuthGroup | null> {
    return this.prisma.authGroup.findUnique({ where: { id } });
  }

  async findGroupByCode(code: string): Promise<AuthGroup | null> {
    return this.prisma.authGroup.findUnique({ where: { code } });
  }

  async listGroups(pagination: PaginationInput): Promise<{ items: AuthGroup[]; total: number }> {
    const limit = pagination.limit ?? 50;
    const offset = pagination.offset ?? 0;
    const [items, total] = await Promise.all([
      this.prisma.authGroup.findMany({
        skip: offset,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prisma.authGroup.count(),
    ]);
    return { items, total };
  }

  async createGroup(input: {
    code: string;
    name: string;
    description?: string;
  }): Promise<AuthGroup> {
    return this.prisma.authGroup.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
      },
    });
  }

  async updateGroup(
    id: string,
    input: { name?: string; description?: string },
  ): Promise<AuthGroup> {
    return this.prisma.authGroup.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
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

  async findPermissionById(id: string): Promise<AuthPermission | null> {
    return this.prisma.authPermission.findUnique({ where: { id } });
  }

  async findPermissionByCode(code: string): Promise<AuthPermission | null> {
    return this.prisma.authPermission.findUnique({ where: { code } });
  }

  async listPermissions(
    pagination: PaginationInput,
  ): Promise<{ items: AuthPermission[]; total: number }> {
    const limit = pagination.limit ?? 50;
    const offset = pagination.offset ?? 0;
    const [items, total] = await Promise.all([
      this.prisma.authPermission.findMany({
        skip: offset,
        take: limit,
        orderBy: [{ category: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.authPermission.count(),
    ]);
    return { items, total };
  }

  async createPermission(input: {
    code: string;
    name: string;
    description?: string;
    category: string;
  }): Promise<AuthPermission> {
    return this.prisma.authPermission.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        category: input.category,
      },
    });
  }

  async updatePermission(
    id: string,
    input: { name?: string; description?: string; category?: string },
  ): Promise<AuthPermission> {
    return this.prisma.authPermission.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
      },
    });
  }

  async deletePermission(id: string): Promise<void> {
    await this.prisma.authPermission.delete({ where: { id } });
  }

  async countPermissionUsage(id: string): Promise<number> {
    return this.prisma.groupPermission.count({ where: { permissionId: id } });
  }

  // ── UserGroup memberships ───────────────────────────────────────────────────

  async findUserGroup(userId: string, groupId: string): Promise<UserGroup | null> {
    return this.prisma.userGroup.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
  }

  async listUserGroups(userId: string): Promise<UserGroup[]> {
    return this.prisma.userGroup.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async assignUserToGroup(input: {
    userId: string;
    groupId: string;
    grantedBy?: string;
  }): Promise<UserGroup> {
    try {
      return await this.prisma.userGroup.create({
        data: {
          userId: input.userId,
          groupId: input.groupId,
          grantedBy: input.grantedBy ?? null,
        },
      });
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

  async findGroupPermission(groupId: string, permissionId: string): Promise<GroupPermission | null> {
    return this.prisma.groupPermission.findUnique({
      where: { groupId_permissionId: { groupId, permissionId } },
    });
  }

  async listGroupPermissions(groupId: string): Promise<GroupPermission[]> {
    return this.prisma.groupPermission.findMany({
      where: { groupId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assignPermissionToGroup(groupId: string, permissionId: string): Promise<GroupPermission> {
    return this.prisma.groupPermission.create({
      data: { groupId, permissionId },
    });
  }

  async revokePermissionFromGroup(groupId: string, permissionId: string): Promise<void> {
    await this.prisma.groupPermission.delete({
      where: { groupId_permissionId: { groupId, permissionId } },
    });
  }

  // ── Group implications ───────────────────────────────────────────────────────

  async findImplication(groupId: string, impliedGroupId: string): Promise<GroupImplication | null> {
    return this.prisma.groupImplication.findUnique({
      where: { groupId_impliedGroupId: { groupId, impliedGroupId } },
    });
  }

  async listGroupImplications(): Promise<GroupImplication[]> {
    return this.prisma.groupImplication.findMany();
  }

  async addGroupImplication(groupId: string, impliedGroupId: string): Promise<GroupImplication> {
    return this.prisma.groupImplication.create({
      data: { groupId, impliedGroupId },
    });
  }

  async removeGroupImplication(groupId: string, impliedGroupId: string): Promise<void> {
    await this.prisma.groupImplication.delete({
      where: { groupId_impliedGroupId: { groupId, impliedGroupId } },
    });
  }

  // ── Record rules ─────────────────────────────────────────────────────────────

  async findRecordRuleById(id: string): Promise<AuthRecordRule | null> {
    return this.prisma.authRecordRule.findUnique({ where: { id } });
  }

  async listRecordRules(
    filter: { modelName?: string },
    pagination: PaginationInput,
  ): Promise<{ items: AuthRecordRule[]; total: number }> {
    const limit = pagination.limit ?? 50;
    const offset = pagination.offset ?? 0;
    const where = filter.modelName ? { modelName: filter.modelName } : {};
    const [items, total] = await Promise.all([
      this.prisma.authRecordRule.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ modelName: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.authRecordRule.count({ where }),
    ]);
    return { items, total };
  }

  async createRecordRule(input: {
    name: string;
    description?: string;
    modelName: string;
    groupId?: string;
    mode: 'read' | 'write' | 'create' | 'unlink';
    domainExpression: unknown;
    isActive: boolean;
  }): Promise<AuthRecordRule> {
    return this.prisma.authRecordRule.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        modelName: input.modelName,
        groupId: input.groupId ?? null,
        mode: input.mode as RecordRuleMode,
        domainExpression: input.domainExpression as any,
        isActive: input.isActive,
      },
    });
  }

  async updateRecordRule(
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
  ): Promise<AuthRecordRule> {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data['name'] = input.name;
    if (input.description !== undefined) data['description'] = input.description;
    if (input.modelName !== undefined) data['modelName'] = input.modelName;
    if ('groupId' in input) data['groupId'] = input.groupId;
    if (input.mode !== undefined) data['mode'] = input.mode as RecordRuleMode;
    if (input.domainExpression !== undefined) data['domainExpression'] = input.domainExpression;
    if (input.isActive !== undefined) data['isActive'] = input.isActive;

    return this.prisma.authRecordRule.update({
      where: { id },
      data: data as any,
    });
  }

  async deleteRecordRule(id: string): Promise<void> {
    await this.prisma.authRecordRule.delete({ where: { id } });
  }
}
