/**
 * Entidades de dominio para métodos de pago guardados (wallet del usuario)
 *
 * Principios aplicados:
 * - Domain-Driven Design: Entidades sin dependencias de infraestructura
 * - Clean Architecture: Capa de dominio aislada de Prisma y frameworks
 *
 * Nota de diseño (borrado):
 *   SavedPaymentMethod usa borrado lógico (isActive=false), NO borrado físico.
 *   El campo isActive=false conserva el historial de métodos de pago asociados
 *   a órdenes anteriores. El borrado físico rompería auditoría/trazabilidad.
 */

export type PaymentMethodType =
  | 'credit_card'
  | 'debit_card'
  | 'paypal'
  | 'bank_transfer'
  | 'cash_on_delivery';

export interface SavedPaymentMethod {
  id: string;
  userId: string;
  type: PaymentMethodType;
  provider: string;
  lastFour?: string;
  expiryMonth?: number;
  expiryYear?: number;
  cardholderName?: string;
  isDefault: boolean;
  /** isActive=false equivale a soft-delete. No se borran físicamente los métodos. */
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSavedPaymentMethodRequest {
  userId: string;
  type: PaymentMethodType;
  provider: string;
  lastFour?: string;
  expiryMonth?: number;
  expiryYear?: number;
  cardholderName?: string;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateSavedPaymentMethodRequest {
  cardholderName?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
  /** Pasar isActive=false para efectuar el soft-delete lógico */
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}
