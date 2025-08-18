import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@domain/interfaces/ILogger';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';

export interface LogoutUserRequest {
  userId: string;
  sessionId?: string;
  reason?: 'user_request' | 'timeout' | 'admin_force' | 'security_breach';
}

export interface LogoutUserResponse {
  userId: string;
  sessionId?: string;
  loggedOutAt: string;
  reason: string;
  sessionsInvalidated: number;
}

export class LogoutUserUseCase {
  constructor(
    private authRepository: IAuthRepository,
    private logger: ILogger
  ) {}

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'LogoutUser' }
  })
  async execute(request: LogoutUserRequest): Promise<LogoutUserResponse> {
    this.logger.info('Starting user logout process', {
      userId: request.userId,
      sessionId: request.sessionId,
      reason: request.reason
    });

    try {
      // Invalidar sesiones del usuario
      await this.authRepository.invalidateUserSessions(request.userId);
      
      // Si se especifica una sesión específica, invalidarla también
      if (request.sessionId) {
        await this.authRepository.deleteSession(request.sessionId);
      }

      // Obtener información de sesiones invalidadas para logging
      const userSessions = await this.authRepository.findSessionsByUserId(request.userId);
      const activeSessions = userSessions.filter(session => session.isActive);
      const sessionsInvalidated = activeSessions.length;

      this.logger.info('User logout completed successfully', {
        userId: request.userId,
        sessionsInvalidated,
        reason: request.reason
      });

      return {
        userId: request.userId,
        sessionId: request.sessionId,
        loggedOutAt: new Date().toISOString(),
        reason: request.reason || 'user_request',
        sessionsInvalidated
      };

    } catch (error) {
      this.logger.error('User logout failed', error as Error, {
        userId: request.userId,
        sessionId: request.sessionId,
        reason: request.reason
      });
      throw error;
    }
  }
}
