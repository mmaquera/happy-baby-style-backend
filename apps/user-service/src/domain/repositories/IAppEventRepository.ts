import { AppEvent, CreateAppEventRequest } from '@domain/entities/Analytics';

/**
 * Puerto de dominio para eventos de analítica de la aplicación.
 *
 * Principios aplicados:
 * - Dependency Inversion: Interface definida en dominio; implementación en infraestructura.
 * - Clean Architecture: No hay imports de Prisma ni frameworks aquí.
 *
 * Decisiones de diseño:
 *   - AppEvent es inmutable: no existe método update. Los eventos de analítica
 *     nunca se modifican una vez creados (append-only log).
 *   - No existe hard-delete a nivel de dominio: la retención/purga es
 *     responsabilidad de un job de mantenimiento, no de un use-case.
 *   - Todos los métodos de listado requieren `limit` obligatorio para evitar
 *     queries sin cota en una tabla de crecimiento ilimitado.
 *   - productId es una referencia cross-service (product-service). Se almacena
 *     como string; la resolución del objeto Product se hace vía Federation.
 */
export interface IAppEventRepository {
  /**
   * Retorna los eventos más recientes de un usuario, ordenados por createdAt DESC.
   * `limit` es obligatorio — nunca retorna un array sin cota.
   */
  findByUserId(userId: string, limit: number): Promise<AppEvent[]>;

  /**
   * Retorna los eventos más recientes asociados a un producto, ordenados por createdAt DESC.
   * `limit` es obligatorio — nunca retorna un array sin cota.
   * Útil para analytics de popularidad de producto desde user-service.
   */
  findByProductId(productId: string, limit: number): Promise<AppEvent[]>;

  /**
   * Retorna los eventos de un tipo específico para un usuario, ordenados por createdAt DESC.
   * Útil para use-cases como "últimos productos vistos", "últimas búsquedas".
   */
  findByUserIdAndType(userId: string, eventType: string, limit: number): Promise<AppEvent[]>;

  /**
   * Persiste un nuevo evento de analítica.
   * userId y productId son opcionales para soportar eventos anónimos.
   */
  create(data: CreateAppEventRequest): Promise<AppEvent>;
}
