import Redis from 'ioredis';
import { IEventPublisher, OrderCreatedEvent } from '../../domain/ports/IEventPublisher';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class RedisEventPublisher implements IEventPublisher {
  private readonly logger: ILogger;

  constructor(private readonly redis: Redis) {
    this.logger = LoggerFactory.getInstance().createServiceLogger('RedisEventPublisher');
  }

  async publishOrderCreated(event: OrderCreatedEvent): Promise<void> {
    const stream = 'stream:order-events';
    const payload = JSON.stringify(event);

    const entryId = await this.redis.xadd(
      stream,
      'MAXLEN',
      '~',
      '10000',
      '*',
      'type',
      'order.created',
      'payload',
      payload,
    );

    this.logger.info('Enqueued order.created event', {
      stream,
      entryId,
      eventId: event.eventId,
      orderId: event.orderId,
      orderNumber: event.orderNumber,
      itemCount: event.items.length,
    });
  }
}
