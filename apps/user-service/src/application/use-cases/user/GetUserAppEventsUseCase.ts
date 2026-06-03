import { IAppEventRepository } from '@domain/repositories/IAppEventRepository';
import { AppEvent } from '@domain/entities/Analytics';
import { ValidationError } from '@domain/errors/DomainError';
import { LoggerFactory } from '@hbs/logging';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export interface GetUserAppEventsRequest {
  userId: string;
  limit?: number;
}

export class GetUserAppEventsUseCase {
  private readonly logger = LoggerFactory.getInstance().createUseCaseLogger(
    'GetUserAppEventsUseCase',
  );

  constructor(private readonly appEventRepo: IAppEventRepository) {}

  async execute(request: GetUserAppEventsRequest): Promise<AppEvent[]> {
    if (!request.userId) {
      throw new ValidationError('userId is required', 'userId');
    }

    const limit = request.limit ?? DEFAULT_LIMIT;
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new ValidationError(`limit must be between 1 and ${MAX_LIMIT}`, 'limit');
    }

    this.logger.info('Getting user app events', { userId: request.userId, limit });

    const events = await this.appEventRepo.findByUserId(request.userId, limit);

    this.logger.info('User app events retrieved', {
      userId: request.userId,
      count: events.length,
    });

    return events;
  }
}
