import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { ILogger } from '@domain/interfaces/ILogger';
import { ValidationError } from '@domain/errors/DomainError';
import { LoggingDecorator } from '@infrastructure/logging/LoggingDecorator';

export interface RefreshTokenRequest {
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

export interface RefreshTokenResponse {
  user: any;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  isNewUser: boolean;
  provider: string;
  session: {
    id: string;
    expiresAt: string;
    isActive: boolean;
  };
}

export class RefreshTokenUseCase {
  constructor(
    private authRepository: IAuthRepository,
    private logger: ILogger
  ) {}

  @LoggingDecorator.logUseCase({
    includeArgs: false, // No incluir refreshToken por seguridad
    includeResult: true,
    includeDuration: true,
    context: { useCase: 'RefreshToken' }
  })
  async execute(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const startTime = Date.now();
    
    this.logger.info('Starting token refresh process', {
      hasRefreshToken: !!request.refreshToken,
      userAgent: request.userAgent || 'unknown',
      ipAddress: request.ipAddress || 'unknown',
      sessionId: request.sessionId,
      operation: 'refreshToken'
    });

    try {
      // Validación robusta del refresh token
      this.validateRefreshToken(request.refreshToken);

      // Validar formato del token (debe ser un UUID válido o JWT válido)
      this.validateTokenFormat(request.refreshToken);

      // Intentar refrescar la sesión del usuario
      const authResult = await this.authRepository.refreshUserSession(request.refreshToken);

      // Validar que la sesión sea válida
      if (!authResult.user || !authResult.tokens) {
        throw new ValidationError('Invalid session data returned from repository');
      }

      // Log de éxito con contexto completo
      const duration = Date.now() - startTime;
      this.logger.info('Token refresh completed successfully', {
        userId: authResult.user.id,
        provider: authResult.provider,
        isNewUser: authResult.isNewUser,
        duration,
        operation: 'refreshToken',
        context: {
          userAgent: request.userAgent,
          ipAddress: request.ipAddress,
          sessionId: request.sessionId
        }
      });

      return {
        user: authResult.user,
        tokens: {
          accessToken: authResult.tokens.accessToken,
          refreshToken: authResult.tokens.refreshToken || ''
        },
        isNewUser: authResult.isNewUser,
        provider: authResult.provider,
        session: {
          id: request.sessionId || 'unknown',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas por defecto
          isActive: true
        }
      };

    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Token refresh failed', error as Error, {
        hasRefreshToken: !!request.refreshToken,
        userAgent: request.userAgent || 'unknown',
        ipAddress: request.ipAddress || 'unknown',
        sessionId: request.sessionId,
        duration,
        operation: 'refreshToken',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  private validateRefreshToken(refreshToken: string): void {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new ValidationError('Refresh token is required and must be a string');
    }

    if (refreshToken.trim() === '') {
      throw new ValidationError('Refresh token cannot be empty');
    }

    if (refreshToken.length < 10) {
      throw new ValidationError('Refresh token is too short');
    }

    if (refreshToken.length > 1000) {
      throw new ValidationError('Refresh token is too long');
    }
  }

  private validateTokenFormat(token: string): void {
    // Validar que sea un UUID válido o JWT válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;

    if (!uuidRegex.test(token) && !jwtRegex.test(token)) {
      throw new ValidationError('Invalid refresh token format');
    }
  }
}
