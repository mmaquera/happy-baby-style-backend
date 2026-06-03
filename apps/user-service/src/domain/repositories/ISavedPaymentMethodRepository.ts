import {
  SavedPaymentMethod,
  CreateSavedPaymentMethodRequest,
  UpdateSavedPaymentMethodRequest,
} from '@domain/entities/Payment';

/**
 * Puerto de dominio para el wallet de métodos de pago guardados del usuario.
 *
 * Principios aplicados:
 * - Dependency Inversion: Interface definida en dominio; implementación en infraestructura.
 * - Clean Architecture: No hay imports de Prisma ni frameworks aquí.
 *
 * Decisión de borrado:
 *   Se usa SOFT-DELETE (isActive=false) en lugar de borrado físico.
 *   Razón: los métodos de pago pueden estar referenciados en el historial de
 *   órdenes (order-service). Borrar físicamente rompe la trazabilidad del pago.
 *   El método `deactivate` encapsula esta semántica a nivel de dominio.
 *
 * Nota sobre `isDefault`:
 *   Solo puede existir un método default por userId. La implementación debe
 *   ejecutar `UPDATE SET is_default=false WHERE user_id=? AND id != ?`
 *   dentro de una transacción al activar un nuevo default.
 */
export interface ISavedPaymentMethodRepository {
  /**
   * Retorna todos los métodos de pago activos de un usuario.
   * Excluye los desactivados (soft-deleted) por defecto.
   */
  findByUserId(userId: string, includeInactive?: boolean): Promise<SavedPaymentMethod[]>;

  /**
   * Busca un método de pago por su ID.
   * Retorna null si no existe o si fue desactivado y includeInactive es false.
   */
  findById(id: string, includeInactive?: boolean): Promise<SavedPaymentMethod | null>;

  /**
   * Retorna el método de pago marcado como default de un usuario.
   * Retorna null si el usuario no tiene ningún método default activo.
   */
  findDefaultByUserId(userId: string): Promise<SavedPaymentMethod | null>;

  /**
   * Persiste un nuevo método de pago para el usuario.
   * Si isDefault=true, la implementación debe desactivar el default previo
   * en la misma transacción.
   */
  create(data: CreateSavedPaymentMethodRequest): Promise<SavedPaymentMethod>;

  /**
   * Actualiza los campos mutables de un método de pago existente.
   * Si isDefault=true, la implementación debe desactivar el default previo.
   */
  update(id: string, data: UpdateSavedPaymentMethodRequest): Promise<SavedPaymentMethod>;

  /**
   * Soft-delete: marca isActive=false y, si era el método default, limpia isDefault.
   * No borra el registro físicamente para preservar historial de órdenes.
   * Retorna el registro actualizado.
   */
  deactivate(id: string): Promise<SavedPaymentMethod>;

  /**
   * Establece un método de pago como default, desactivando el anterior.
   * Debe ejecutarse en una sola transacción (no dos queries separadas).
   */
  setDefault(userId: string, id: string): Promise<SavedPaymentMethod>;
}
