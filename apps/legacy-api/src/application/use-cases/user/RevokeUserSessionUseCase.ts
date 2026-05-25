import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@domain/interfaces/ILogger';
import { ValidationError, NotFoundError, UnauthorizedError } from '@domain/errors/DomainError';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';

export interface RevokeUserSessionRequest {
  sessionId: string;
  userId: string; // ID del usuario que solicita la revocación
  reason?: string; // Razón opcional para la revocación
}

export interface RevokeUserSessionResponse {
  sessionId: string;
  revokedAt: string;
  reason?: string;
  analyticsCleaned: boolean;
}

export class RevokeUserSessionUseCase {
  constructor(
    private authRepository: IAuthRepository,
    private logger: ILogger
  ) {}

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'RevokeUserSession' }
  })
  async execute(request: RevokeUserSessionRequest): Promise<RevokeUserSessionResponse> {
    this.logger.info('Starting user session revocation', {
      sessionId: request.sessionId,
      userId: request.userId,
      reason: request.reason,
      operation: 'RevokeUserSession'
    });

    try {
      // Validate input
      this.validateRequest(request);

      // Check if session exists and get session details
      const session = await this.authRepository.findSessionByToken(request.sessionId);
      if (!session) {
        throw new NotFoundError('UserSession', request.sessionId);
      }

      // Check if user has permission to revoke this session
      // Users can only revoke their own sessions, admins can revoke any session
      if (session.userId !== request.userId) {
        this.logger.warn('Unauthorized session revocation attempt', {
          sessionId: request.sessionId,
          sessionUserId: session.userId,
          requestingUserId: request.userId,
          operation: 'RevokeUserSession'
        });
        throw new UnauthorizedError('You can only revoke your own sessions');
      }

      // Check if session is already inactive
      if (!session.isActive) {
        this.logger.info('Session already inactive, no action needed', {
          sessionId: request.sessionId,
          userId: request.userId,
          operation: 'RevokeUserSession'
        });
        
        return {
          sessionId: request.sessionId,
          revokedAt: new Date().toISOString(),
          reason: request.reason,
          analyticsCleaned: false // Already inactive, no analytics to clean
        };
      }

      // Revoke the session (set as inactive)
      await this.authRepository.updateSession(request.sessionId, {
        isActive: false,
        expiresAt: new Date() // Force immediate expiration
      });

      // Clean up session analytics if they exist
      let analyticsCleaned = false;
      try {
        await this.authRepository.deleteSessionAnalyticsBySessionId(request.sessionId);
        analyticsCleaned = true;
        
        this.logger.info('Session analytics cleaned successfully', {
          sessionId: request.sessionId,
          userId: request.userId,
          operation: 'RevokeUserSession'
        });
      } catch (analyticsError) {
        // Log error but don't fail the session revocation
        this.logger.warn('Failed to clean session analytics', {
          sessionId: request.sessionId,
          userId: request.userId,
          error: analyticsError instanceof Error ? analyticsError.message : 'Unknown error',
          operation: 'RevokeUserSession'
        });
      }

      this.logger.info('User session revoked successfully', {
        sessionId: request.sessionId,
        userId: request.userId,
        reason: request.reason,
        analyticsCleaned,
        operation: 'RevokeUserSession'
      });

      return {
        sessionId: request.sessionId,
        revokedAt: new Date().toISOString(),
        reason: request.reason,
        analyticsCleaned
      };

    } catch (error) {
      this.logger.error('Failed to revoke user session', error as Error, {
        sessionId: request.sessionId,
        userId: request.userId,
        operation: 'RevokeUserSession'
      });
      throw error;
    }
  }

  private validateRequest(request: RevokeUserSessionRequest): void {
    if (!request.sessionId || typeof request.sessionId !== 'string') {
      throw new ValidationError('Session ID is required and must be a string');
    }

    if (!request.userId || typeof request.userId !== 'string') {
      throw new ValidationError('User ID is required and must be a string');
    }

    if (request.reason !== undefined && typeof request.reason !== 'string') {
      throw new ValidationError('Reason must be a string if provided');
    }

    if (request.reason !== undefined && request.reason.length > 500) {
      throw new ValidationError('Reason must be less than 500 characters');
    }
  }
}
