export enum UserRole {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
  STAFF = 'staff',
}

export enum Permission {
  CREATE_PRODUCT = 'create:product',
  READ_PRODUCT = 'read:product',
  UPDATE_PRODUCT = 'update:product',
  DELETE_PRODUCT = 'delete:product',

  CREATE_ORDER = 'create:order',
  READ_ORDER = 'read:order',
  UPDATE_ORDER = 'update:order',
  DELETE_ORDER = 'delete:order',

  CREATE_USER = 'create:user',
  READ_USER = 'read:user',
  UPDATE_USER = 'update:user',
  DELETE_USER = 'delete:user',

  MANAGE_USERS = 'manage:users',
  MANAGE_SYSTEM = 'manage:system',
  VIEW_ANALYTICS = 'view:analytics',
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  // string[] to accommodate RBAC permission codes alongside the Permission enum values.
  // The Permission enum values are all valid string codes (e.g. "create:product").
  permissions: string[];
  // RBAC group codes resolved from user_groups (populated post-Fase-5.5).
  // Optional: absent in tokens issued before RBAC backfill.
  groups?: string[];
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole; // kept for backward compat — will be removed in Fase 5.11
  // string[] to accommodate RBAC permission codes alongside the Permission enum values.
  // All Permission enum values are valid strings (e.g. "create:product").
  permissions: string[];
  // RBAC group codes resolved transitively via CTE (populated post-Fase-5.5).
  // Empty array or absent means the legacy role-based fallback was used.
  groups?: string[];
  iat?: number;
  exp?: number;
}

/**
 * Centralized token type constants to prevent typos and token-confusion attacks.
 * Use these instead of raw string literals when setting the `type` claim in JWT payloads.
 */
export const TOKEN_TYPES = {
  REFRESH: 'refresh',
  PASSWORD_RESET: 'password_reset',
  EMAIL_VERIFICATION: 'email_verification',
  MFA_CHALLENGE: 'mfa_challenge',
} as const;
