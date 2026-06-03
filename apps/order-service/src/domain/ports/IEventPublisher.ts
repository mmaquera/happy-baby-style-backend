export interface OrderCreatedEvent {
  /** UUID v4 for idempotency — consumers use this as InboxEvent key. */
  eventId: string;
  orderId: string;
  orderNumber: string;
  items: {
    productId: string;
    variantId: string;
    variantSize: string;
    variantColor: string;
    quantity: number;
  }[];
  createdAt: string;
}

export interface OrderConfirmedEvent {
  /** UUID v4 for idempotency — consumers use this as InboxEvent key. */
  eventId: string;
  orderId: string;
  orderNumber: string;
  /** ISO 8601 timestamp of confirmation. */
  confirmedAt: string;
}

export interface OrderCancelledEvent {
  /** UUID v4 for idempotency — consumers use this as InboxEvent key. */
  eventId: string;
  orderId: string;
  orderNumber: string;
  /** Optional free-text reason provided by the actor. */
  reason?: string;
  /** ISO 8601 timestamp of cancellation. */
  cancelledAt: string;
}

export interface IEventPublisher {
  publishOrderCreated(event: OrderCreatedEvent): Promise<void>;

  /**
   * Emitted when an order transitions to `confirmed` status.
   * Intended consumers: invoicing-service (round ⑦), notification-service.
   * XADD implementation in RedisEventPublisher is wired in round ⑤.
   */
  publishOrderConfirmed(event: OrderConfirmedEvent): Promise<void>;

  /**
   * Emitted when an order transitions to `cancelled` status.
   * Intended consumers: inventory-service (stock reconciliation), notification-service.
   * XADD implementation in RedisEventPublisher is wired in round ⑤.
   */
  publishOrderCancelled(event: OrderCancelledEvent): Promise<void>;
}
