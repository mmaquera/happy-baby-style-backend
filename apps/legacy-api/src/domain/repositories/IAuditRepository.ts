import { AuditLog, CreateAuditLogRequest } from '@domain/entities/Audit';

/**
 * Repositorio de dominio para logs de auditoría
 *
 * Principios aplicados:
 * - Dependency Inversion: Interface en la capa de dominio
 * - Clean Architecture: Define el contrato sin implementación
 */
export interface IAuditRepository {
  /**
   * Crea un nuevo log de auditoría
   */
  create(data: CreateAuditLogRequest): Promise<AuditLog>;

  /**
   * Busca logs de auditoría por ID de usuario
   */
  findByUserId(userId: string): Promise<AuditLog[]>;

  /**
   * Busca logs de auditoría por acción
   */
  findByAction(action: string, limit?: number): Promise<AuditLog[]>;

  /**
   * Busca un log de auditoría por ID
   */
  findById(id: string): Promise<AuditLog | null>;

  /**
   * Busca logs de auditoría por tabla y registro
   */
  findByTableAndRecord(tableName: string, recordId: string): Promise<AuditLog[]>;
}
