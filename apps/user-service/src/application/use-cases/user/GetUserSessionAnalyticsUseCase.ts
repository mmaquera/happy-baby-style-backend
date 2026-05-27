import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@hbs/logging';
import { UserSessionAnalytics } from '@domain/entities/Auth';
import { ValidationError } from '@domain/errors/DomainError';
import { LoggingDecorator } from '@hbs/logging';

export interface GetUserSessionAnalyticsRequest {
  userId: string;
  limit?: number;
  offset?: number;
  sessionId?: string;
}

export interface GetUserSessionAnalyticsResponse {
  analytics: UserSessionAnalytics[];
  total: number;
  hasMore: boolean;
  pagination: {
    limit: number;
    offset: number;
    currentPage: number;
    totalPages: number;
  };
}

export class GetUserSessionAnalyticsUseCase {
  constructor(
    private authRepository: IAuthRepository,
    private logger: ILogger,
  ) {}

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'GetUserSessionAnalytics' },
  })
  async execute(request: GetUserSessionAnalyticsRequest): Promise<GetUserSessionAnalyticsResponse> {
    this.logger.info('Starting user session analytics retrieval', {
      userId: request.userId,
      sessionId: request.sessionId,
      limit: request.limit,
      offset: request.offset,
      operation: 'GetUserSessionAnalytics',
    });

    try {
      // Validate input
      this.validateRequest(request);

      // Set default pagination values
      const limit = request.limit || 20;
      const offset = request.offset || 0;

      let analytics: UserSessionAnalytics[];

      if (request.sessionId) {
        // Get analytics for specific session
        const sessionAnalytics = await this.authRepository.findSessionAnalyticsBySessionId(
          request.sessionId,
        );
        analytics = sessionAnalytics ? [sessionAnalytics] : [];
      } else {
        // Get all analytics for user
        analytics = await this.authRepository.findSessionAnalyticsByUserId(request.userId);
      }

      // Apply pagination
      const total = analytics.length;
      const paginatedAnalytics = analytics.slice(offset, offset + limit);
      const hasMore = offset + limit < total;
      const currentPage = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(total / limit);

      this.logger.info('User session analytics retrieved successfully', {
        userId: request.userId,
        total,
        returned: paginatedAnalytics.length,
        hasMore,
        operation: 'GetUserSessionAnalytics',
      });

      return {
        analytics: paginatedAnalytics,
        total,
        hasMore,
        pagination: {
          limit,
          offset,
          currentPage,
          totalPages,
        },
      };
    } catch (error) {
      this.logger.error('Failed to retrieve user session analytics', error as Error, {
        userId: request.userId,
        operation: 'GetUserSessionAnalytics',
      });
      throw error;
    }
  }

  private validateRequest(request: GetUserSessionAnalyticsRequest): void {
    if (!request.userId || typeof request.userId !== 'string') {
      throw new ValidationError('User ID is required and must be a string');
    }

    if (
      request.limit !== undefined &&
      (typeof request.limit !== 'number' || request.limit < 1 || request.limit > 100)
    ) {
      throw new ValidationError('Limit must be a number between 1 and 100');
    }

    if (
      request.offset !== undefined &&
      (typeof request.offset !== 'number' || request.offset < 0)
    ) {
      throw new ValidationError('Offset must be a non-negative number');
    }

    if (request.sessionId !== undefined && typeof request.sessionId !== 'string') {
      throw new ValidationError('Session ID must be a string');
    }
  }
}
