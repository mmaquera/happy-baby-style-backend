import { SecurityEvent, CreateSecurityEventRequest } from '@domain/entities/Audit';

/**
 * Repositorio de dominio para eventos de seguridad
 * 
 * Principios aplicados:
 * - Dependency Inversion: Interface en la capa de dominio
 * - Clean Architecture: Define el contrato sin implementación
 */
export interface ISecurityEventRepository {
  /**
   * Crea un nuevo evento de seguridad
   */
  create(data: CreateSecurityEventRequest): Promise<SecurityEvent>;

  /**
   * Busca eventos de seguridad por ID de usuario
   */
  findByUserId(userId: string): Promise<SecurityEvent[]>;

  /**
   * Busca eventos de seguridad por tipo
   */
  findByEventType(eventType: string, limit?: number): Promise<SecurityEvent[]>;

  /**
   * Busca un evento de seguridad por ID
   */
  findById(id: string): Promise<SecurityEvent | null>;

  /**
   * Busca eventos de seguridad recientes
   */
  findRecent(limit?: number): Promise<SecurityEvent[]>;
}

