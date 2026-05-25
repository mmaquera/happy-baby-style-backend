import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@hbs/logging';
import { UserSessionAnalytics, UpdateUserSessionAnalyticsRequest } from '@domain/entities/Auth';
import { ValidationError, NotFoundError } from '@domain/errors/DomainError';
import { LoggingDecorator } from '@hbs/logging';

export interface UpdateUserSessionAnalyticsResponse {
  analytics: UserSessionAnalytics;
  changes: string[];
}

export class UpdateUserSessionAnalyticsUseCase {
  constructor(
    private authRepository: IAuthRepository,
    private logger: ILogger
  ) {}

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'UpdateUserSessionAnalytics' }
  })
  async execute(
    id: string, 
    request: UpdateUserSessionAnalyticsRequest
  ): Promise<UpdateUserSessionAnalyticsResponse> {
    this.logger.info('Starting user session analytics update', {
      analyticsId: id,
      operation: 'UpdateUserSessionAnalytics'
    });

    try {
      // Validate input
      this.validateRequest(id, request);

      // Check if analytics exist
      const existingAnalytics = await this.authRepository.findSessionAnalyticsById(id);
      if (!existingAnalytics) {
        throw new NotFoundError('UserSessionAnalytics', id);
      }

      // Track changes
      const changes = this.trackChanges(existingAnalytics, request);

      // Update analytics
      const updatedAnalytics = await this.authRepository.updateSessionAnalytics(id, request);

      this.logger.info('User session analytics updated successfully', {
        analyticsId: id,
        sessionId: updatedAnalytics.sessionId,
        userId: updatedAnalytics.userId,
        changes,
        operation: 'UpdateUserSessionAnalytics'
      });

      return {
        analytics: updatedAnalytics,
        changes
      };

    } catch (error) {
      this.logger.error('Failed to update user session analytics', error as Error, {
        analyticsId: id,
        operation: 'UpdateUserSessionAnalytics'
      });
      throw error;
    }
  }

  private validateRequest(id: string, request: UpdateUserSessionAnalyticsRequest): void {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Analytics ID is required and must be a string');
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

  private trackChanges(
    existing: UserSessionAnalytics, 
    updates: UpdateUserSessionAnalyticsRequest
  ): string[] {
    const changes: string[] = [];

    if (updates.pageViews !== undefined && updates.pageViews !== existing.pageViews) {
      changes.push(`pageViews: ${existing.pageViews} → ${updates.pageViews}`);
    }

    if (updates.timeSpent !== undefined && updates.timeSpent !== existing.timeSpent) {
      changes.push(`timeSpent: ${existing.timeSpent} → ${updates.timeSpent}`);
    }

    if (updates.bounceRate !== undefined && updates.bounceRate !== existing.bounceRate) {
      changes.push(`bounceRate: ${existing.bounceRate} → ${updates.bounceRate}`);
    }

    if (updates.conversionRate !== undefined && updates.conversionRate !== existing.conversionRate) {
      changes.push(`conversionRate: ${existing.conversionRate} → ${updates.conversionRate}`);
    }

    if (updates.deviceType !== undefined && updates.deviceType !== existing.deviceType) {
      changes.push(`deviceType: ${existing.deviceType || 'null'} → ${updates.deviceType}`);
    }

    if (updates.browser !== undefined && updates.browser !== existing.browser) {
      changes.push(`browser: ${existing.browser || 'null'} → ${updates.browser}`);
    }

    if (updates.os !== undefined && updates.os !== existing.os) {
      changes.push(`os: ${existing.os || 'null'} → ${updates.os}`);
    }

    if (updates.country !== undefined && updates.country !== existing.country) {
      changes.push(`country: ${existing.country || 'null'} → ${updates.country}`);
    }

    if (updates.city !== undefined && updates.city !== existing.city) {
      changes.push(`city: ${existing.city || 'null'} → ${updates.city}`);
    }

    return changes;
  }
}
