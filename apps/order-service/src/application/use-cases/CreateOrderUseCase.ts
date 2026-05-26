import { IOrderRepository } from '../../domain/repositories/IOrderRepository';
import { IProductValidationPort } from '../../domain/ports/IProductValidationPort';
import { IEventPublisher } from '../../domain/ports/IEventPublisher';
import { CreateOrderRequest, Order } from '../../domain/entities/Order';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class CreateOrderUseCase {
  private readonly logger: ILogger;

  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly productValidation: IProductValidationPort,
    private readonly eventPublisher: IEventPublisher,
  ) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('CreateOrderUseCase');
  }

  async execute(orderData: CreateOrderRequest): Promise<Order> {
    // Validate products and calculate total via product-service (no direct DB dependency)
    const validatedItems = await Promise.all(
      orderData.items.map(async (item) => {
        const product = await this.productValidation.getProductById(item.productId);

        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }
        if (!product.isActive) {
          throw new Error(`Product ${product.name} is not active`);
        }

        const totalStock = product.stockQuantity;
        if (totalStock < item.quantity) {
          throw new Error(
            `Insufficient stock for product ${product.name}. Available: ${totalStock}, Requested: ${item.quantity}`,
          );
        }

        const variant = product.variants?.find(
          (v) => v.size === item.size && v.color === item.color && v.isActive,
        );

        if (!variant) {
          throw new Error(
            `Variant ${item.size}/${item.color} not available for product ${product.name}`,
          );
        }

        if (variant.stockQuantity < item.quantity) {
          throw new Error(
            `Insufficient variant stock for ${item.size}/${item.color} of ${product.name}. Available: ${variant.stockQuantity}`,
          );
        }

        return { product, variant, item };
      }),
    );

    const total = validatedItems.reduce((sum, { product, variant, item }) => {
      const itemPrice = variant.price || product.price;
      return sum + itemPrice * item.quantity;
    }, 0);

    const order = await this.orderRepository.create(orderData, total);

    // Publish async event for stock decrement — product-service subscribes
    try {
      await this.eventPublisher.publishOrderCreated({
        orderId: order.id,
        orderNumber: order.orderNumber,
        items: orderData.items.map((item) => ({
          productId: item.productId,
          variantSize: item.size,
          variantColor: item.color,
          quantity: item.quantity,
        })),
        createdAt: order.createdAt.toISOString(),
      });
    } catch (publishError) {
      // Non-fatal: order is created, stock decrement will retry via event replay
      this.logger.warn('Failed to publish order.created event', {
        orderId: order.id,
        error: publishError instanceof Error ? publishError.message : String(publishError),
      });
    }

    this.logger.info('Order created', { orderId: order.id, orderNumber: order.orderNumber, total });

    return order;
  }
}
