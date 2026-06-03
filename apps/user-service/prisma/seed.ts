/**
 * RBAC Seed — Fase A2
 *
 * Seeds system groups, permissions, group_permissions mappings,
 * and group_implications hierarchy.
 *
 * Design decision: EXPLICIT permissions on every group (no runtime inheritance
 * resolution required at seed time). The group_implications record is still
 * created so the inheritance machinery is present and can be activated
 * progressively in the authorization layer.
 *
 * Backfill (role → user_groups) removed in A2: user_profiles.role column
 * is dropped by migration 0002_drop_legacy_role. New users are assigned to the
 * 'customer' group inside the CreateUserUseCase transaction (see backend Fase 2).
 *
 * Idempotent: every write uses upsert — safe to run multiple times.
 *
 * Moved from libs/prisma/seed.ts → apps/user-service/prisma/seed.ts (Fase B — item 7.13).
 * Uses the user-service per-service generated client.
 */

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Data definitions
// ---------------------------------------------------------------------------

const PERMISSIONS = [
  { code: 'create:product', name: 'Create Product', category: 'product' },
  { code: 'read:product', name: 'Read Product', category: 'product' },
  { code: 'update:product', name: 'Update Product', category: 'product' },
  { code: 'delete:product', name: 'Delete Product', category: 'product' },
  { code: 'create:order', name: 'Create Order', category: 'order' },
  { code: 'read:order', name: 'Read Order', category: 'order' },
  { code: 'update:order', name: 'Update Order', category: 'order' },
  { code: 'delete:order', name: 'Delete Order', category: 'order' },
  { code: 'create:user', name: 'Create User', category: 'user' },
  { code: 'read:user', name: 'Read User', category: 'user' },
  { code: 'update:user', name: 'Update User', category: 'user' },
  { code: 'delete:user', name: 'Delete User', category: 'user' },
  { code: 'manage:users', name: 'Manage Users', category: 'user' },
  { code: 'manage:system', name: 'Manage System', category: 'system' },
  { code: 'view:analytics', name: 'View Analytics', category: 'analytics' },
  // Ola 1 — Catálogo: moderate product reviews (approve / reject)
  { code: 'reviews:moderate', name: 'Moderate Reviews', category: 'product' },
  // FE-0 — Fiscal profile (SUNAT)
  { code: 'update:fiscal-profile', name: 'Update Fiscal Profile', category: 'user' },
] as const;

const GROUPS = [
  {
    code: 'administrators',
    name: 'Administrators',
    description: 'Full system access. Cannot be deleted.',
    isSystem: true,
    permissionCodes: [
      'create:product',
      'read:product',
      'update:product',
      'delete:product',
      'create:order',
      'read:order',
      'update:order',
      'delete:order',
      'create:user',
      'read:user',
      'update:user',
      'delete:user',
      'manage:users',
      'manage:system',
      'view:analytics',
      'update:fiscal-profile',
    ],
  },
  {
    code: 'sales-manager',
    name: 'Sales Manager',
    description: 'Manage orders, view analytics, supervise sales team.',
    isSystem: true,
    permissionCodes: [
      'read:order',
      'update:order',
      'read:user',
      'view:analytics',
      'read:product',
    ],
  },
  {
    code: 'sales-user',
    name: 'Sales User',
    description: 'Read/update orders. Customer-facing order handling.',
    isSystem: true,
    permissionCodes: ['read:order', 'update:order', 'read:product'],
  },
  {
    code: 'inventory-user',
    name: 'Inventory User',
    description: 'Read/update product stock and variants.',
    isSystem: true,
    permissionCodes: ['read:product', 'update:product'],
  },
  {
    code: 'customer-service',
    name: 'Customer Service',
    description: 'Read user info + read orders + view analytics. Can moderate product reviews.',
    isSystem: true,
    permissionCodes: ['read:user', 'read:order', 'view:analytics', 'read:product', 'reviews:moderate'],
  },
  {
    code: 'customer',
    name: 'Customer',
    description: 'End user. Browse products, place own orders.',
    isSystem: true,
    permissionCodes: ['read:product', 'create:order', 'read:order', 'read:user', 'update:fiscal-profile'],
  },
] as const;

/**
 * group_implications: Sales Manager (groupCode) implies Sales User (impliedGroupCode).
 * Meaning: the Sales Manager "inherits from" Sales User in Odoo semantics —
 * i.e. Sales Manager is the higher group that subsumes the lower (Sales User).
 *
 * Explicit permissions are declared on each group above, so this record
 * exists purely to activate the inheritance engine when it is ready.
 */
const IMPLICATIONS: Array<{ groupCode: string; impliedGroupCode: string }> = [
  { groupCode: 'sales-manager', impliedGroupCode: 'sales-user' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PermCode = (typeof PERMISSIONS)[number]['code'];

async function upsertPermissions(): Promise<Map<PermCode, string>> {
  const permIdMap = new Map<PermCode, string>();

  for (const perm of PERMISSIONS) {
    const record = await prisma.authPermission.upsert({
      where: { code: perm.code },
      create: {
        code: perm.code,
        name: perm.name,
        category: perm.category,
      },
      update: {
        name: perm.name,
        category: perm.category,
      },
    });
    permIdMap.set(perm.code as PermCode, record.id);
  }

  return permIdMap;
}

async function upsertGroups(): Promise<Map<string, string>> {
  const groupIdMap = new Map<string, string>();

  for (const group of GROUPS) {
    const record = await prisma.authGroup.upsert({
      where: { code: group.code },
      create: {
        code: group.code,
        name: group.name,
        description: group.description,
        isSystem: group.isSystem,
      },
      update: {
        name: group.name,
        description: group.description,
        // isSystem is intentionally NOT updated — once set to true, stays true.
      },
    });
    groupIdMap.set(group.code, record.id);
  }

  return groupIdMap;
}

async function upsertGroupPermissions(
  groupIdMap: Map<string, string>,
  permIdMap: Map<PermCode, string>,
): Promise<number> {
  let count = 0;

  for (const group of GROUPS) {
    const groupId = groupIdMap.get(group.code)!;

    for (const permCode of group.permissionCodes) {
      const permissionId = permIdMap.get(permCode as PermCode)!;

      await prisma.groupPermission.upsert({
        where: {
          groupId_permissionId: { groupId, permissionId },
        },
        create: { groupId, permissionId },
        update: {}, // no updatable columns on this pivot
      });
      count++;
    }
  }

  return count;
}

/**
 * Record rules for UserFiscalProfile (FE-0).
 * The `customer` group can read and write only their own fiscal profile.
 * Self-service access is enforced by ownership (userId == $ctx.userId).
 * Administrators have no record rule restriction — they can access all records.
 */
const FISCAL_PROFILE_RECORD_RULES: Array<{
  name: string;
  modelName: string;
  groupCode: string;
  mode: string;
  domainExpression: object;
}> = [
  {
    name: 'Customer: own fiscal profile (read)',
    modelName: 'UserFiscalProfile',
    groupCode: 'customer',
    mode: 'read',
    domainExpression: { op: '=', field: 'userId', value: { $ctx: 'userId' } },
  },
  {
    name: 'Customer: own fiscal profile (write)',
    modelName: 'UserFiscalProfile',
    groupCode: 'customer',
    mode: 'write',
    domainExpression: { op: '=', field: 'userId', value: { $ctx: 'userId' } },
  },
];

async function upsertFiscalProfileRecordRules(groupIdMap: Map<string, string>): Promise<number> {
  let count = 0;
  for (const rule of FISCAL_PROFILE_RECORD_RULES) {
    const groupId = groupIdMap.get(rule.groupCode);
    if (!groupId) continue;

    // Upsert by (modelName, groupId, mode) — unique enough for our seed
    const existing = await prisma.authRecordRule.findFirst({
      where: { modelName: rule.modelName, groupId, mode: rule.mode as any },
    });

    if (existing) {
      await prisma.authRecordRule.update({
        where: { id: existing.id },
        data: {
          name: rule.name,
          domainExpression: rule.domainExpression,
          isActive: true,
        },
      });
    } else {
      await prisma.authRecordRule.create({
        data: {
          name: rule.name,
          modelName: rule.modelName,
          groupId,
          mode: rule.mode as any,
          domainExpression: rule.domainExpression,
          isActive: true,
        },
      });
    }
    count++;
  }
  return count;
}

async function upsertGroupImplications(
  groupIdMap: Map<string, string>,
): Promise<number> {
  let count = 0;

  for (const impl of IMPLICATIONS) {
    const groupId = groupIdMap.get(impl.groupCode)!;
    const impliedGroupId = groupIdMap.get(impl.impliedGroupCode)!;

    await prisma.groupImplication.upsert({
      where: {
        groupId_impliedGroupId: { groupId, impliedGroupId },
      },
      create: { groupId, impliedGroupId },
      update: {}, // no updatable columns on this pivot
    });
    count++;
  }

  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('[seed] Starting RBAC seed...');

  const permIdMap = await upsertPermissions();
  console.log(`[seed] permissions: ${permIdMap.size} upserted`);

  const groupIdMap = await upsertGroups();
  console.log(`[seed] groups: ${groupIdMap.size} upserted`);

  const gpCount = await upsertGroupPermissions(groupIdMap, permIdMap);
  console.log(`[seed] group_permissions: ${gpCount} upserted`);

  const giCount = await upsertGroupImplications(groupIdMap);
  console.log(`[seed] group_implications: ${giCount} upserted`);

  const rrCount = await upsertFiscalProfileRecordRules(groupIdMap);
  console.log(`[seed] fiscal_profile_record_rules: ${rrCount} upserted`);

  console.log('[seed] Done.');
  console.log(
    `[seed] Summary: ${groupIdMap.size} groups | ${permIdMap.size} permissions | ` +
      `${gpCount} group_permission rows | ${giCount} group_implication rows`,
  );
}

main()
  .catch((err) => {
    console.error('[seed] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
