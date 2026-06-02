/**
 * Pure domain entities for the RBAC/authz bounded context.
 *
 * These interfaces are isomorphic to the Prisma-generated types but carry zero
 * dependency on @prisma/client.  The infrastructure layer (PrismaAuthzRepository)
 * is responsible for mapping Prisma results to these types at the boundary.
 *
 * Field notes:
 *  - `domainExpression` is typed as `unknown` at the domain level because the
 *    authoritative shape is owned by @hbs/authz (DomainExprSchema / DomainExpr).
 *    Using `unknown` instead of `JsonValue` keeps the domain free of Prisma's
 *    Json typedef while still being fully type-safe at usage sites.
 *  - `RecordRuleMode` is re-declared here as a plain union so domain code never
 *    imports the Prisma enum.
 */

export type RecordRuleModeValue = 'read' | 'write' | 'create' | 'unlink';

export interface AuthGroupEntity {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthPermissionEntity {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupPermissionEntity {
  groupId: string;
  permissionId: string;
  createdAt: Date;
}

export interface GroupImplicationEntity {
  groupId: string;
  impliedGroupId: string;
  createdAt: Date;
}

export interface UserGroupEntity {
  userId: string;
  groupId: string;
  grantedAt: Date;
  grantedBy: string | null;
}

export interface AuthRecordRuleEntity {
  id: string;
  name: string;
  description: string | null;
  modelName: string;
  groupId: string | null;
  mode: RecordRuleModeValue;
  /** Validated by @hbs/authz DomainExprSchema at the application boundary. */
  domainExpression: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
