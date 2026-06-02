import { PrismaClient, Prisma } from '../../prisma';
import { LoggerFactory, ILogger } from '@hbs/logging';

export interface OrderCreatedEventItem {
  productId: string;
  variantId: string;
  variantSize: string;
  variantColor: string;
  quantity: number;
}

export interface OrderCreatedEvent {
  eventId: string;
  orderId: string;
  orderNumber: string;
  items: OrderCreatedEventItem[];
  createdAt: string;
}

export interface ApplyOrderStockResult {
  applied: boolean;
  reason?: 'duplicate';
}

export class ApplyOrderStockUseCase {
  private readonly logger: ILogger;

  constructor(private readonly prisma: PrismaClient) {
    this.logger = LoggerFactory.getInstance().createUseCaseLogger('ApplyOrderStockUseCase');
  }

  async execute(event: OrderCreatedEvent): Promise<ApplyOrderStockResult> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Idempotency guard: inserting the event id first means a redelivery of the
        // same event hits the unique PK and throws P2002, aborting the whole transaction.
        await tx.inboxEvent.create({ data: { eventId: event.eventId } });

        for (const item of event.items) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
          await tx.inventoryTransaction.create({
            data: {
              productId: item.productId,
              type: 'sale',
              quantity: item.quantity,
              reference: event.orderId,
              notes: item.variantId,
            },
          });
        }
      });

      this.logger.info('Applied order stock decrement', {
        eventId: event.eventId,
        orderId: event.orderId,
        itemCount: event.items.length,
      });
      return { applied: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.info('Skipping already-processed order event', {
          eventId: event.eventId,
          orderId: event.orderId,
        });
        return { applied: false, reason: 'duplicate' };
      }
      throw error;
    }
  }
}
