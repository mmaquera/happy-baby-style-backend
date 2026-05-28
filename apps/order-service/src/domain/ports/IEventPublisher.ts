export interface OrderCreatedEvent {
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

export interface IEventPublisher {
  publishOrderCreated(event: OrderCreatedEvent): Promise<void>;
}
