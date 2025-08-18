import { ILogger } from '@domain/interfaces/ILogger';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ValidationError, UnauthorizedError } from '@domain/errors/DomainError';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';

export interface SessionValidationResult {
  isValid: boolean;
  sessionId: string;
  userId: string;
  expiresAt: Date;
  isActive: boolean;
}

export interface SessionRefreshResult {
  sessionId: string;
  userId: string;
  newAccessToken: string;
  newRefreshToken: string;
  expiresAt: Date;
}

export class SessionService {
  constructor(
    private authRepository: IAuthRepository,
    private logger: ILogger
  ) {}

  @LoggingDecorator.logUseCase({
    includeArgs: false,
    includeResult: true,
    includeDuration: true,
    context: { service: 'SessionService' }
  })
  async validateSession(sessionToken: string): Promise<SessionValidationResult> {
    this.logger.info('Validating session', {
      hasSessionToken: !!sessionToken,
      operation: 'validateSession'
    });

    try {
      if (!sessionToken || typeof sessionToken !== 'string') {
        throw new ValidationError('Session token is required');
      }

      const sessionInfo = await this.authRepository.validateSession(sessionToken);
      
      if (!sessionInfo) {
        throw new UnauthorizedError('Invalid session token');
      }

      const result: SessionValidationResult = {
        isValid: sessionInfo.isActive && sessionInfo.expiresAt > new Date(),
        sessionId: sessionInfo.userId, // Usar userId como sessionId temporal
        userId: sessionInfo.userId,
        expiresAt: sessionInfo.expiresAt,
        isActive: sessionInfo.isActive
      };

      this.logger.info('Session validation completed', {
        sessionId: result.sessionId,
        userId: result.userId,
        isValid: result.isValid,
        expiresAt: result.expiresAt,
        operation: 'validateSession'
      });

      return result;

    } catch (error) {
      this.logger.error('Session validation failed', error as Error, {
        hasSessionToken: !!sessionToken,
        operation: 'validateSession'
      });
      throw error;
    }
  }

  @LoggingDecorator.logUseCase({
    includeArgs: false,
    includeResult: true,
    includeDuration: true,
    context: { service: 'SessionService' }
  })
  async refreshSession(refreshToken: string): Promise<SessionRefreshResult> {
    this.logger.info('Refreshing session', {
      hasRefreshToken: !!refreshToken,
      operation: 'refreshSession'
    });

    try {
      if (!refreshToken || typeof refreshToken !== 'string') {
        throw new ValidationError('Refresh token is required');
      }

      const authResult = await this.authRepository.refreshUserSession(refreshToken);
      
      if (!authResult.user || !authResult.tokens) {
        throw new UnauthorizedError('Failed to refresh session');
      }

      const result: SessionRefreshResult = {
        sessionId: authResult.user.id, // Usar userId como sessionId temporal
        userId: authResult.user.id,
        newAccessToken: authResult.tokens.accessToken,
        newRefreshToken: authResult.tokens.refreshToken || '',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días
      };

      this.logger.info('Session refresh completed', {
        sessionId: result.sessionId,
        userId: result.userId,
        hasNewTokens: !!(result.newAccessToken && result.newRefreshToken),
        expiresAt: result.expiresAt,
        operation: 'refreshSession'
      });

      return result;

    } catch (error) {
      this.logger.error('Session refresh failed', error as Error, {
        hasRefreshToken: !!refreshToken,
        operation: 'refreshSession'
      });
      throw error;
    }
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: false,
    includeDuration: true,
    context: { service: 'SessionService' }
  })
  async invalidateSession(sessionId: string, userId: string): Promise<void> {
    this.logger.info('Invalidating session', {
      sessionId,
      userId,
      operation: 'invalidateSession'
    });

    try {
      await this.authRepository.logoutUser(userId, sessionId);
      
      this.logger.info('Session invalidated successfully', {
        sessionId,
        userId,
        operation: 'invalidateSession'
      });

    } catch (error) {
      this.logger.error('Session invalidation failed', error as Error, {
        sessionId,
        userId,
        operation: 'invalidateSession'
      });
      throw error;
    }
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { service: 'SessionService' }
  })
  async getSessionInfo(sessionId: string): Promise<SessionValidationResult | null> {
    this.logger.info('Getting session info', {
      sessionId,
      operation: 'getSessionInfo'
    });

    try {
      // Implementar lógica para obtener información de sesión
      // Por ahora retornamos null ya que no tenemos un método específico
      this.logger.warn('getSessionInfo not fully implemented', {
        sessionId,
        operation: 'getSessionInfo'
      });

      return null;

    } catch (error) {
      this.logger.error('Failed to get session info', error as Error, {
        sessionId,
        operation: 'getSessionInfo'
      });
      throw error;
    }
  }
}
