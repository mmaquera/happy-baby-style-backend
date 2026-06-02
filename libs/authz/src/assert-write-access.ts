import type { TokenPayload } from '@hbs/auth';
import { NotFoundError } from '@hbs/shared-kernel';
import type { RecordRuleResolver, RecordRuleMode } from './record-rule-resolver';

/**
 * Options for assertWriteAccess.
 *
 * exists: probe callback injected by the caller so that @hbs/authz does not
 * import @prisma/client directly. Receives a Prisma-compatible `where` shape
 * and returns true if at least one row matches.
 */
export interface AssertWriteAccessOptions {
  /** Resolved RecordRuleResolver instance. undefined → fail-open (no restriction). */
  resolver: RecordRuleResolver | undefined;
  /** PascalCase entity name used as key for rule lookup, e.g. "Order". */
  modelName: string;
  /** Write mode being enforced. Only write-side modes are accepted here. */
  mode: Extract<RecordRuleMode, 'write' | 'unlink'>;
  /** Primary key of the record being mutated. */
  id: string;
  /** Authenticated user from the request context, or null for unauthenticated callers. */
  currentUser: TokenPayload | null;
  /**
   * Callback that probes the database for a matching row.
   *
   * When resolveWhere returns {} (no rules → full access), the probe is:
   *   { id }
   * When resolveWhere returns a combined filter, the probe is:
   *   { AND: [{ id }, ruleWhere] }
   * When resolveWhere returns DENY_WHERE ({ AND: [{ NOT: {} }] }), the probe
   * will never match any row, so exists() returns false → NotFoundError is thrown.
   *
   * The 404 response is intentionally ambiguous ("record does not exist OR access
   * denied") to prevent enumeration oracles (Odoo ir.rule semantics).
   */
  exists: (where: Record<string, unknown>) => Promise<boolean>;
}

/**
 * Enforces write-side record rules for a single entity by ID.
 *
 * Semantics:
 * - resolver undefined  → no-op; caller retains unrestricted write access.
 * - ruleWhere is {}     → probe with { id } only (existence check, no filter).
 * - ruleWhere non-empty → probe with { AND: [{ id }, ruleWhere] } (combined filter).
 * - DENY_WHERE returned → probe never matches → NotFoundError thrown (ambiguous 404).
 *
 * The ambiguous 404 intentionally conflates "not found" and "access denied" to
 * prevent resource-existence enumeration (CWE-200 / OWASP BOLA mitigation).
 *
 * @throws NotFoundError when the record does not exist or the rule denies access.
 */
export async function assertWriteAccess(opts: AssertWriteAccessOptions): Promise<void> {
  const { resolver, modelName, mode, id, currentUser, exists } = opts;

  // fail-open: no resolver wired → no restriction (compat during rollout)
  if (!resolver) return;

  const ruleWhere = await resolver.resolveWhere(modelName, mode, currentUser);

  const isEmpty = Object.keys(ruleWhere).length === 0;
  const probeWhere: Record<string, unknown> = isEmpty ? { id } : { AND: [{ id }, ruleWhere] };

  const found = await exists(probeWhere);

  if (!found) {
    // Ambiguous 404: "does not exist or access denied" — prevents enumeration oracle.
    throw new NotFoundError(modelName, id);
  }
}
