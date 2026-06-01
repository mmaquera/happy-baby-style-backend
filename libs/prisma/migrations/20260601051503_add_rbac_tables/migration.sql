-- Migration A: Add RBAC tables (additive only — no ALTER, no DROP)
-- Adds: record_rule_mode enum, groups, permissions, group_permissions,
--       group_implications, user_groups, record_rules

-- CreateEnum
CREATE TYPE "record_rule_mode" AS ENUM ('read', 'write', 'create', 'unlink');

-- CreateTable: groups
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable: permissions
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: group_permissions (M:N pivot)
CREATE TABLE "group_permissions" (
    "group_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_permissions_pkey" PRIMARY KEY ("group_id","permission_id")
);

-- CreateTable: group_implications (M:N self-ref — Odoo-style transitive inheritance)
-- App-level constraints: no self-reference (group_id != implied_group_id),
-- no cycles (A->B->A). Both must be enforced in the service layer.
CREATE TABLE "group_implications" (
    "group_id" TEXT NOT NULL,
    "implied_group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_implications_pkey" PRIMARY KEY ("group_id","implied_group_id")
);

-- CreateTable: user_groups (M:N pivot users <-> groups)
CREATE TABLE "user_groups" (
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("user_id","group_id")
);

-- CreateTable: record_rules (row-level access rules per model/group/mode)
-- domain_expression: JSONB — no DB-level shape validation; validate in app layer.
CREATE TABLE "record_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "model_name" TEXT NOT NULL,
    "group_id" TEXT,
    "mode" "record_rule_mode" NOT NULL,
    "domain_expression" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "record_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: groups
CREATE UNIQUE INDEX "groups_code_key" ON "groups"("code");
CREATE INDEX "groups_code_idx" ON "groups"("code");

-- CreateIndex: permissions
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE INDEX "permissions_code_idx" ON "permissions"("code");
CREATE INDEX "permissions_category_idx" ON "permissions"("category");

-- CreateIndex: group_permissions
CREATE INDEX "group_permissions_group_id_idx" ON "group_permissions"("group_id");
CREATE INDEX "group_permissions_permission_id_idx" ON "group_permissions"("permission_id");

-- CreateIndex: group_implications
CREATE INDEX "group_implications_group_id_idx" ON "group_implications"("group_id");
CREATE INDEX "group_implications_implied_group_id_idx" ON "group_implications"("implied_group_id");

-- CreateIndex: user_groups
CREATE INDEX "user_groups_user_id_idx" ON "user_groups"("user_id");
CREATE INDEX "user_groups_group_id_idx" ON "user_groups"("group_id");

-- CreateIndex: record_rules
CREATE INDEX "record_rules_model_name_idx" ON "record_rules"("model_name");
CREATE INDEX "record_rules_group_id_idx" ON "record_rules"("group_id");
CREATE INDEX "record_rules_model_name_mode_is_active_idx" ON "record_rules"("model_name", "mode", "is_active");

-- AddForeignKey: group_permissions -> groups, permissions
ALTER TABLE "group_permissions" ADD CONSTRAINT "group_permissions_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_permissions" ADD CONSTRAINT "group_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: group_implications -> groups (both directions)
ALTER TABLE "group_implications" ADD CONSTRAINT "group_implications_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_implications" ADD CONSTRAINT "group_implications_implied_group_id_fkey"
    FOREIGN KEY ("implied_group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: user_groups -> user_profiles (CASCADE), groups (RESTRICT)
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: record_rules -> groups (CASCADE — rules are orphaned when group deleted)
ALTER TABLE "record_rules" ADD CONSTRAINT "record_rules_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
