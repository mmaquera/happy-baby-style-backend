/**
 * Entidades de dominio para Auditoría y Eventos de Seguridad
 *
 * Principios aplicados:
 * - Domain-Driven Design: Entidades que representan conceptos del dominio
 * - Clean Architecture: Capa de dominio sin dependencias externas
 */

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  tableName?: string;
  recordId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface CreateAuditLogRequest {
  userId?: string;
  action: string;
  tableName?: string;
  recordId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface SecurityEvent {
  id: string;
  userId?: string;
  eventType: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface CreateSecurityEventRequest {
  userId?: string;
  eventType: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Tipos de eventos de seguridad comunes
 */
export enum SecurityEventType {
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_SET_BY_ADMIN = 'password_set_by_admin',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
}

/**
 * Tipos de acciones de auditoría comunes
 */
export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  PASSWORD_UPDATE = 'password_update',
  PASSWORD_RESET = 'password_reset',
  LOGIN = 'login',
  LOGOUT = 'logout',
}
