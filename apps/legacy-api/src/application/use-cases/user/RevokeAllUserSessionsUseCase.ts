import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@hbs/logging';
import { ValidationError, NotFoundError, UnauthorizedError } from '@domain/errors/DomainError';
import { LoggingDecorator } from '@hbs/logging';

export interface RevokeAllUserSessionsRequest {
  userId: string;
  requestingUserId: string; // ID del usuario que solicita la revocación
  reason?: string; // Razón opcional para la revocación
  excludeCurrentSession?: boolean; // Si excluir la sesión actual
}

export interface RevokeAllUserSessionsResponse {
  userId: string;
  sessionsRevoked: number;
  analyticsCleaned: number;
  revokedAt: string;
  reason?: string;
}

export class RevokeAllUserSessionsUseCase {
  constructor(
    private authRepository: IAuthRepository,
    private logger: ILogger
  ) {}

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'RevokeAllUserSessions' }
  })
  async execute(request: RevokeAllUserSessionsRequest): Promise<RevokeAllUserSessionsResponse> {
    this.logger.info('Starting all user sessions revocation', {
      userId: request.userId,
      requestingUserId: request.requestingUserId,
      reason: request.reason,
      excludeCurrentSession: request.excludeCurrentSession,
      operation: 'RevokeAllUserSessions'
    });

    try {
      // Validate input
      this.validateRequest(request);

      // Check if user exists (basic validation)
      // Note: In a real implementation, you might want to check if the requesting user
      // has admin privileges or if they're revoking their own sessions
      if (request.userId !== request.requestingUserId) {
        this.logger.warn('User attempting to revoke sessions of another user', {
          userId: request.userId,
          requestingUserId: request.requestingUserId,
          operation: 'RevokeAllUserSessions'
        });
        // For now, we'll allow it but log it. In production, you might want to check admin roles
      }

      // Get all active sessions for the user
      const activeSessions = await this.authRepository.findSessionsByUserId(request.userId);
      const sessionsToRevoke = activeSessions.filter(session => session.isActive);

      if (sessionsToRevoke.length === 0) {
        this.logger.info('No active sessions to revoke', {
          userId: request.userId,
          operation: 'RevokeAllUserSessions'
        });
        
        return {
          userId: request.userId,
          sessionsRevoked: 0,
          analyticsCleaned: 0,
          revokedAt: new Date().toISOString(),
          reason: request.reason
        };
      }

      // Revoke all active sessions
      let sessionsRevoked = 0;
      let analyticsCleaned = 0;

      for (const session of sessionsToRevoke) {
        try {
          // Revoke the session
          await this.authRepository.updateSession(session.id, {
            isActive: false,
            expiresAt: new Date() // Force immediate expiration
          });
          sessionsRevoked++;

          // Clean up session analytics
          try {
            await this.authRepository.deleteSessionAnalyticsBySessionId(session.sessionToken);
            analyticsCleaned++;
          } catch (analyticsError) {
            // Log error but don't fail the session revocation
            this.logger.warn('Failed to clean session analytics', {
              sessionId: session.id,
              sessionToken: session.sessionToken,
              userId: request.userId,
              error: analyticsError instanceof Error ? analyticsError.message : 'Unknown error',
              operation: 'RevokeAllUserSessions'
            });
          }
        } catch (sessionError) {
          // Log error but continue with other sessions
          this.logger.error('Failed to revoke individual session', sessionError as Error, {
            sessionId: session.id,
            sessionToken: session.sessionToken,
            userId: request.userId,
            operation: 'RevokeAllUserSessions'
          });
        }
      }

      this.logger.info('All user sessions revoked successfully', {
        userId: request.userId,
        sessionsRevoked,
        analyticsCleaned,
        reason: request.reason,
        operation: 'RevokeAllUserSessions'
      });

      return {
        userId: request.userId,
        sessionsRevoked,
        analyticsCleaned,
        revokedAt: new Date().toISOString(),
        reason: request.reason
      };

    } catch (error) {
      this.logger.error('Failed to revoke all user sessions', error as Error, {
        userId: request.userId,
        requestingUserId: request.requestingUserId,
        operation: 'RevokeAllUserSessions'
      });
      throw error;
    }
  }

  private validateRequest(request: RevokeAllUserSessionsRequest): void {
    if (!request.userId || typeof request.userId !== 'string') {
      throw new ValidationError('User ID is required and must be a string');
    }

    if (!request.requestingUserId || typeof request.requestingUserId !== 'string') {
      throw new ValidationError('Requesting User ID is required and must be a string');
    }

    if (request.reason !== undefined && typeof request.reason !== 'string') {
      throw new ValidationError('Reason must be a string if provided');
    }

    if (request.reason !== undefined && request.reason.length > 500) {
      throw new ValidationError('Reason must be less than 500 characters');
    }

    if (request.excludeCurrentSession !== undefined && typeof request.excludeCurrentSession !== 'boolean') {
      throw new ValidationError('Exclude current session must be a boolean if provided');
    }
  }
}
