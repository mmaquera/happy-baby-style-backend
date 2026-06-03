import { IAppEventRepository } from '@domain/repositories/IAppEventRepository';
import { AppEvent } from '@domain/entities/Analytics';
import { ValidationError } from '@domain/errors/DomainError';
import { LoggerFactory } from '@hbs/logging';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export interface GetProductAppEventsRequest {
  productId: string;
  limit?: number;
}

export class GetProductAppEventsUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'GetProductAppEventsUseCase',
  );

  constructor(private readonly appEventRepo: IAppEventRepository) {}

  async execute(request: GetProductAppEventsRequest): Promise<AppEvent[]> {
    if (!request.productId) {
      throw new ValidationError('productId is required', 'productId');
    }

    const limit = request.limit ?? DEFAULT_LIMIT;
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new ValidationError(`limit must be between 1 and ${MAX_LIMIT}`, 'limit');
    }

    this.logger.info('Getting product app events', { productId: request.productId, limit });

    const events = await this.appEventRepo.findByProductId(request.productId, limit);

    this.logger.info('Product app events retrieved', {
      productId: request.productId,
      count: events.length,
    });

    return events;
  }
}
