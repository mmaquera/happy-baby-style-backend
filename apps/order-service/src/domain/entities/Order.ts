import { BusinessLogicError } from '@hbs/shared-kernel';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

/**
 * Canonical state machine for order commercial-status transitions.
 *
 * Design rationale (Odoo-aligned):
 *   - Transition table is the single source of truth — previously split between
 *     UpdateOrderUseCase.validateStatusTransition() and canBe*() entity methods.
 *   - `transition()` is the ONLY mutation point; it validates and returns a new
 *     immutable instance (never mutates `this`).
 *   - canBe*() helpers are implemented in terms of the same table so they cannot
 *     diverge.
 */
const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
} as const;

export interface ShippingAddress {
  id: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// ─── Tipo de afectación IGV — local a order-service ────────────────────────────
// Definido localmente (no importado de otro servicio). invoicing-service tendrá
// su propia copia del tipo. Los valores reflejan el catálogo SUNAT 07 simplificado.
export type TaxAffectation = 'gravado' | 'exonerado' | 'inafecto';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  createdAt: Date;
  // ── Snapshot tributario inmutable (Ronda 1 / Tarea 1b) ─────────────────────
  // Escrito en create; jamás actualizado. Backend-expert los persiste en Ronda 2.
  taxAffectation?: TaxAffectation;
  igvBase?: number;
  igvAmount?: number;
}

/**
 * Fiscal/billing data frozen at order creation time (SUNAT snapshot).
 *
 * Design rationale: the FE sends this at checkout; order-service snapshots the
 * values immediately. They are immutable once the order moves to `confirmed` or
 * any later state. This avoids a runtime dependency on user-service for billing info.
 */
export interface BillingData {
  /** SUNAT document type: 'dni' | 'ruc' | 'passport' | 'ce' */
  documentType: string;
  /** DNI (8 digits) or RUC (11 digits) */
  documentNumber: string;
  /** Required when documentType === 'ruc' (razón social) */
  legalName?: string;
  /** Person's first name — used for 'dni'/'passport'/'ce' */
  firstName?: string;
  /** Person's last name — used for 'dni'/'passport'/'ce' */
  lastName?: string;
  /** Reference to a saved billing address in user-service (optional) */
  addressId?: string;
}

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  shippingAddressId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
  items?: OrderItem[];
  shippingAddress?: ShippingAddress;
  // ── Billing / SUNAT fields (nullable — FE supplies at checkout) ──────────
  billingDocumentType?: string;
  billingDocumentNumber?: string;
  billingLegalName?: string;
  billingFirstName?: string;
  billingLastName?: string;
  billingAddressId?: string;
  // ── Acumuladores IGV (Ronda 1 / Tarea 1b) ──────────────────────────────
  // Calculados en CreateOrderUseCase y persistidos por PrismaOrderRepository.
  // Backend-expert los escribe en Ronda 2. Opcionales para compatibilidad con
  // órdenes históricas (pre-migración) donde los valores son 0 en DB.
  taxableAmount?: number;
  exemptAmount?: number;
  nonTaxableAmount?: number;
  igvAmount?: number;
}

export interface CreateOrderItemRequest {
  productId: string;
  quantity: number;
  size: string;
  color: string;
  // ── Snapshot tributario por línea (Ronda 1 / Tarea 1b) ─────────────────────
  // Calculados por CreateOrderUseCase en Ronda 2 usando igv_rate de StoreSettings.
  // Opcionales aquí para no romper callers existentes; backend-expert los rellena.
  unitPrice?: number;
  /**
   * Pre-computed line total (unitPrice × quantity) calculated with Decimal.js in
   * CreateOrderUseCase. Passed through to PrismaOrderRepository so the DB column
   * is written with the same decimal-precise value as igvBase/igvAmount rather than
   * being recalculated with float arithmetic in the repo.
   * Optional for backward-compat with legacy callers (tests without IGV).
   */
  lineTotal?: number;
  taxAffectation?: TaxAffectation;
  igvBase?: number;
  igvAmount?: number;
}

export interface CreateOrderRequest {
  /** Derived from JWT — never accepted from client input. */
  userId: string;
  /** Derived from JWT — never accepted from client input. */
  customerEmail: string;
  /** Provided by the client for shipping/delivery purposes. Not available in the JWT. */
  customerName: string;
  customerPhone?: string;
  items: CreateOrderItemRequest[];
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
  /**
   * Folio pre-generated by GenerateOrderFolioUseCase and passed to the repo.
   * The repo's create() implementation stores it as orderNumber.
   */
  folio?: string;
  /**
   * Optional fiscal/billing snapshot supplied by the FE at checkout.
   * Stored verbatim; never re-fetched from user-service at runtime.
   */
  billingData?: BillingData;
  // ── Acumuladores IGV de la orden (Ronda 1 / Tarea 1b) ──────────────────────
  // Calculados por CreateOrderUseCase en Ronda 2 y pasados al repo para persistir.
  // Opcionales para no romper callers existentes (tests, Ronda 1 sin IGV aún).
  taxableAmount?: number;
  exemptAmount?: number;
  nonTaxableAmount?: number;
  igvAmount?: number;
}

export interface UpdateOrderRequest {
  status?: OrderStatus;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  deliveredAt?: Date;
  /**
   * Billing fields are accepted on the update path so that use-case validation
   * can explicitly reject them when the order is already confirmed (immutability guard).
   * They are NOT written to DB from update — only the create path persists billing data.
   */
  billingData?: BillingData;
}

// ── Billing immutability guard ─────────────────────────────────────────────────
// Statuses at or past 'confirmed' — billing fields MUST NOT change after this point.
export const BILLING_IMMUTABLE_FROM: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export class OrderEntity implements Order {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly customerEmail: string,
    public readonly customerName: string,
    public readonly status: OrderStatus,
    public readonly paymentStatus: PaymentStatus,
    public readonly subtotal: number,
    public readonly taxAmount: number,
    public readonly shippingAmount: number,
    public readonly discountAmount: number,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly shippingAddressId?: string,
    public readonly notes?: string,
    public readonly deliveredAt?: Date,
    public readonly items: OrderItem[] = [],
    public readonly shippingAddress?: ShippingAddress,
  ) {}

  // ── Commercial-status machine ──────────────────────────────────────────────

  /**
   * Validates and applies a status transition.
   *
   * Returns a NEW immutable OrderEntity with the updated status (never mutates
   * `this`). Throws BusinessLogicError when the transition is not allowed by the
   * canonical table so all callers share the same error semantics.
   *
   * @throws BusinessLogicError when the transition is invalid.
   */
  transition(newStatus: OrderStatus): OrderEntity {
    const allowed = ORDER_STATUS_TRANSITIONS[this.status];
    if (!(allowed as readonly string[]).includes(newStatus)) {
      throw new BusinessLogicError(
        `Invalid status transition from ${this.status} to ${newStatus}`,
      );
    }
    return new OrderEntity(
      this.id,
      this.userId,
      this.orderNumber,
      this.customerEmail,
      this.customerName,
      newStatus,
      this.paymentStatus,
      this.subtotal,
      this.taxAmount,
      this.shippingAmount,
      this.discountAmount,
      this.totalAmount,
      this.currency,
      this.createdAt,
      new Date(),
      this.shippingAddressId,
      this.notes,
      newStatus === 'delivered' ? new Date() : this.deliveredAt,
      this.items,
      this.shippingAddress,
    );
  }

  /**
   * Returns true when the order can move to the given status.
   * Non-throwing convenience wrapper over the transition table.
   */
  canTransitionTo(newStatus: OrderStatus): boolean {
    return (ORDER_STATUS_TRANSITIONS[this.status] as readonly string[]).includes(newStatus);
  }

  canBeCancelled(): boolean {
    return this.canTransitionTo('cancelled');
  }

  canBeShipped(): boolean {
    return this.canTransitionTo('shipped');
  }

  canBeDelivered(): boolean {
    return this.canTransitionTo('delivered');
  }

  // ── Payment-status helpers ─────────────────────────────────────────────────

  /**
   * Returns true when the payment can move to `paid`.
   *
   * The actual transition is driven by payment-service via event (implemented in
   * round ④). This method is the guard-door: future use cases check it before
   * applying the change.
   */
  canBePaid(): boolean {
    return this.paymentStatus === 'pending';
  }

  /**
   * Returns true when the payment can be refunded.
   *
   * Refund is valid from `paid` only; a `failed` or already-`refunded`
   * payment cannot be refunded again.
   */
  canBeRefunded(): boolean {
    return this.paymentStatus === 'paid';
  }

  // ── Labels ─────────────────────────────────────────────────────────────────

  getStatusLabel(): string {
    const statusLabels: Record<OrderStatus, string> = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      processing: 'En Proceso',
      shipped: 'Enviado',
      delivered: 'Entregado',
      cancelled: 'Cancelado',
      refunded: 'Reembolsado',
    };
    return statusLabels[this.status];
  }
}
