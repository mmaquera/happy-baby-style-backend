import Redis from 'ioredis';
import { IEventPublisher, OrderCreatedEvent } from '../../domain/ports/IEventPublisher';
import { LoggerFactory, ILogger } from '@hbs/logging';

export class RedisEventPublisher implements IEventPublisher {
  private readonly logger: ILogger;

  constructor(private readonly redis: Redis) {
    this.logger = LoggerFactory.getInstance().createServiceLogger('RedisEventPublisher');
  }

  async publishOrderCreated(event: OrderCreatedEvent): Promise<void> {
    const channel = 'order:created';
    const payload = JSON.stringify(event);

    await this.redis.publish(channel, payload);

    this.logger.info('Published order:created event', {
      channel,
      orderId: event.orderId,
      orderNumber: event.orderNumber,
      itemCount: event.items.length,
    });
  }
}
