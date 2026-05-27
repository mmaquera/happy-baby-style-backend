export interface OrderCreatedEvent {
  orderId: string;
  orderNumber: string;
  items: {
    productId: string;
    variantSize: string;
    variantColor: string;
    quantity: number;
  }[];
  createdAt: string;
}

export interface IEventPublisher {
  publishOrderCreated(event: OrderCreatedEvent): Promise<void>;
}
