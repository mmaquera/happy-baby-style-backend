/**
 * Entidades de dominio para eventos de analítica de la aplicación
 *
 * Principios aplicados:
 * - Domain-Driven Design: Entidades sin dependencias de infraestructura
 * - Clean Architecture: Capa de dominio aislada de Prisma y frameworks
 *
 * Nota de diseño (AppEvent):
 *   - userId y productId son opcionales: eventos anónimos o eventos de sesión
 *     sin producto específico son válidos.
 *   - AppEvent es inmutable una vez creado (no tiene updatedAt ni método update).
 *   - productId es una referencia cross-service hacia product-service; se resuelve
 *     vía Federation __resolveReference, nunca via JOIN.
 */

export interface AppEvent {
  id: string;
  userId?: string;
  sessionId?: string;
  eventType: string;
  eventData?: Record<string, unknown>;
  /** Referencia cross-service a product-service. Se resuelve vía Federation. */
  productId?: string;
  categoryId?: string;
  deviceInfo?: Record<string, unknown>;
  location?: Record<string, unknown>;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
}

export interface CreateAppEventRequest {
  userId?: string;
  sessionId?: string;
  eventType: string;
  eventData?: Record<string, unknown>;
  productId?: string;
  categoryId?: string;
  deviceInfo?: Record<string, unknown>;
  location?: Record<string, unknown>;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Tipos de eventos de analítica conocidos.
 * Extensible — se usan como constants en los use-cases para evitar strings mágicos.
 */
export enum AppEventType {
  PRODUCT_VIEW = 'product_view',
  PRODUCT_SEARCH = 'product_search',
  CATEGORY_VIEW = 'category_view',
  ADD_TO_CART = 'add_to_cart',
  REMOVE_FROM_CART = 'remove_from_cart',
  CHECKOUT_STARTED = 'checkout_started',
  ORDER_PLACED = 'order_placed',
  PAGE_VIEW = 'page_view',
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
}
