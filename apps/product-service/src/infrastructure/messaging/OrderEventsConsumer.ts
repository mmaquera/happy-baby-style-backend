import Redis from 'ioredis';
import { LoggerFactory, ILogger } from '@hbs/logging';
import {
  ApplyOrderStockUseCase,
  OrderCreatedEvent,
} from '../../application/use-cases/ApplyOrderStockUseCase';

const STREAM = 'stream:order-events';
const GROUP = 'product-service-group';
const IDLE_RECLAIM_MS = 60_000;

type StreamEntry = [id: string, fields: string[]];
type StreamReadResponse = [stream: string, entries: StreamEntry[]][] | null;
type AutoClaimResponse = [cursor: string, entries: StreamEntry[], deleted: string[]];

export class OrderEventsConsumer {
  private readonly logger: ILogger;
  private readonly consumerName: string;
  private running = false;

  constructor(
    private readonly redis: Redis,
    private readonly applyOrderStock: ApplyOrderStockUseCase,
  ) {
    this.logger = LoggerFactory.getInstance().createServiceLogger('OrderEventsConsumer');
    this.consumerName = `product-service-${process.pid}`;
  }

  async start(): Promise<void> {
    await this.ensureGroup();
    this.running = true;
    this.logger.info('Order events consumer started', {
      stream: STREAM,
      group: GROUP,
      consumer: this.consumerName,
    });
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private async ensureGroup(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', STREAM, GROUP, '$', 'MKSTREAM');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('BUSYGROUP')) throw error;
    }
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        await this.reclaimStale();

        const response = (await this.redis.xreadgroup(
          'GROUP',
          GROUP,
          this.consumerName,
          'COUNT',
          10,
          'BLOCK',
          5000,
          'STREAMS',
          STREAM,
          '>',
        )) as StreamReadResponse;

        if (!response) continue;

        for (const [, entries] of response) {
          for (const [id, fields] of entries) {
            await this.handleEntry(id, fields);
          }
        }
      } catch (error) {
        this.logger.error(
          'Order events consumer loop error',
          error instanceof Error ? error : new Error(String(error)),
        );
        await this.delay(1000);
      }
    }
  }

  private async reclaimStale(): Promise<void> {
    try {
      const result = (await this.redis.xautoclaim(
        STREAM,
        GROUP,
        this.consumerName,
        IDLE_RECLAIM_MS,
        '0',
        'COUNT',
        10,
      )) as AutoClaimResponse;

      for (const [id, fields] of result?.[1] ?? []) {
        await this.handleEntry(id, fields);
      }
    } catch (error) {
      // Non-fatal: e.g. transient error or unsupported on older Redis.
      this.logger.warn('xautoclaim failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleEntry(id: string, fields: string[]): Promise<void> {
    const payload = this.readField(fields, 'payload');
    if (!payload) {
      this.logger.warn('Stream entry without payload — acking to discard', { entryId: id });
      await this.redis.xack(STREAM, GROUP, id);
      return;
    }

    try {
      const event = JSON.parse(payload) as OrderCreatedEvent;
      await this.applyOrderStock.execute(event);
      await this.redis.xack(STREAM, GROUP, id);
    } catch (error) {
      // Leave the entry unacked so it stays pending and is retried/reclaimed later.
      this.logger.error(
        'Failed to process order event',
        error instanceof Error ? error : new Error(String(error)),
        { entryId: id },
      );
    }
  }

  private readField(fields: string[], key: string): string | undefined {
    for (let i = 0; i < fields.length; i += 2) {
      if (fields[i] === key) return fields[i + 1];
    }
    return undefined;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
