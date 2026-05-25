import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@domain/interfaces/ILogger';
import { UserSessionAnalytics, CreateUserSessionAnalyticsRequest } from '@domain/entities/Auth';
import { ValidationError } from '@domain/errors/DomainError';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';

export interface CreateUserSessionAnalyticsResponse {
  analytics: UserSessionAnalytics;
}

export class CreateUserSessionAnalyticsUseCase {
  constructor(
    private authRepository: IAuthRepository,
    private logger: ILogger
  ) {}

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'CreateUserSessionAnalytics' }
  })
  async execute(request: CreateUserSessionAnalyticsRequest): Promise<CreateUserSessionAnalyticsResponse> {
    this.logger.info('Starting user session analytics creation', {
      sessionId: request.sessionId,
      userId: request.userId,
      operation: 'CreateUserSessionAnalytics'
    });

    try {
      // Validate required fields
      this.validateRequest(request);

      // Check if analytics already exist for this session
      const existingAnalytics = await this.authRepository.findSessionAnalyticsBySessionId(request.sessionId);
      if (existingAnalytics) {
        this.logger.warn('Session analytics already exist for session', {
          sessionId: request.sessionId,
          analyticsId: existingAnalytics.id,
          operation: 'CreateUserSessionAnalytics'
        });
        
        // Return existing analytics instead of creating new ones
        return {
          analytics: existingAnalytics
        };
      }

      // Create session analytics with default values
      const analyticsData: CreateUserSessionAnalyticsRequest = {
        sessionId: request.sessionId,
        userId: request.userId,
        pageViews: request.pageViews || 0,
        timeSpent: request.timeSpent || 0,
        bounceRate: request.bounceRate || 0,
        conversionRate: request.conversionRate || 0,
        deviceType: request.deviceType,
        browser: request.browser,
        os: request.os,
        country: request.country,
        city: request.city
      };

      const analytics = await this.authRepository.createSessionAnalytics(analyticsData);

      this.logger.info('User session analytics created successfully', {
        analyticsId: analytics.id,
        sessionId: analytics.sessionId,
        userId: analytics.userId,
        operation: 'CreateUserSessionAnalytics'
      });

      return {
        analytics
      };

    } catch (error) {
      this.logger.error('Failed to create user session analytics', error as Error, {
        sessionId: request.sessionId,
        userId: request.userId,
        operation: 'CreateUserSessionAnalytics'
      });
      throw error;
    }
  }

  private validateRequest(request: CreateUserSessionAnalyticsRequest): void {
    if (!request.sessionId || typeof request.sessionId !== 'string') {
      throw new ValidationError('Session ID is required and must be a string');
    }

    if (!request.userId || typeof request.userId !== 'string') {
      throw new ValidationError('User ID is required and must be a string');
    }

    if (request.pageViews !== undefined && (typeof request.pageViews !== 'number' || request.pageViews < 0)) {
      throw new ValidationError('Page views must be a non-negative number');
    }

    if (request.timeSpent !== undefined && (typeof request.timeSpent !== 'number' || request.timeSpent < 0)) {
      throw new ValidationError('Time spent must be a non-negative number');
    }

    if (request.bounceRate !== undefined && (typeof request.bounceRate !== 'number' || request.bounceRate < 0 || request.bounceRate > 1)) {
      throw new ValidationError('Bounce rate must be a number between 0 and 1');
    }

    if (request.conversionRate !== undefined && (typeof request.conversionRate !== 'number' || request.conversionRate < 0 || request.conversionRate > 1)) {
      throw new ValidationError('Conversion rate must be a number between 0 and 1');
    }
  }
}
