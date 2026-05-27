import { LoggingDecorator } from '@hbs/logging';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  BusinessLogicError,
} from '@domain/errors/DomainError';
import { UserValidationService } from '@application/validation/UserValidationService';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { IAuditRepository } from '@domain/repositories/IAuditRepository';
import { ISecurityEventRepository } from '@domain/repositories/ISecurityEventRepository';
import { ILogger } from '@hbs/logging';
import { SecurityEventType, AuditAction } from '@domain/entities/Audit';
import bcrypt from 'bcryptjs';

export interface SetUserPasswordRequest {
  userId: string;
  newPassword: string;
  adminUserId: string; // ID del administrador que ejecuta la acción
  adminEmail?: string; // Email del administrador para auditoría
  ipAddress?: string; // IP del administrador
  userAgent?: string; // User agent del administrador
}

/**
 * Caso de uso para establecer directamente la contraseña de un usuario.
 * Esta es una acción administrativa que requiere permisos de administrador.
 *
 * Principios aplicados:
 * - Clean Architecture: Lógica de negocio en la capa de aplicación
 * - Single Responsibility: Solo establece contraseñas para usuarios
 * - Security: Validación de fortaleza de contraseña y permisos
 */
export class SetUserPasswordUseCase {
  private userValidationService: UserValidationService;

  constructor(
    private authRepository: IAuthRepository,
    private auditRepository: IAuditRepository,
    private securityEventRepository: ISecurityEventRepository,
    private logger: ILogger,
  ) {
    this.userValidationService = new UserValidationService();
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: false, // Don't log password data
    includeDuration: true,
    context: { useCase: 'SetUserPassword' },
  })
  async execute(data: SetUserPasswordRequest): Promise<void> {
    const startTime = Date.now();

    try {
      // 1. Validar parámetros de entrada
      this.validateInputs(data);

      this.logger.info('Starting administrative password set operation', {
        targetUserId: data.userId,
        adminUserId: data.adminUserId,
      });

      // 2. Validar que el usuario objetivo existe
      const targetUser = await this.authRepository.getUserById(data.userId);
      if (!targetUser) {
        throw new NotFoundError('User', data.userId);
      }

      // 3. Validar que el usuario objetivo está activo
      if (!targetUser.isActive) {
        throw new BusinessLogicError('Cannot set password for inactive user', {
          userId: data.userId,
          code: 'USER_INACTIVE',
        });
      }

      // 4. Validar fortaleza de la contraseña
      const passwordValidation = await this.validatePasswordStrength(data.newPassword);
      if (!passwordValidation.isValid) {
        throw new ValidationError(
          `Password is too weak: ${passwordValidation.feedback.join(', ')}`,
          'PASSWORD_TOO_WEAK',
        );
      }

      // 5. Obtener contraseña actual para auditoría (si existe)
      const currentPassword = await this.authRepository.findUserPasswordByUserId(data.userId);
      const oldPasswordHash = currentPassword?.passwordHash;

      // 6. Actualizar contraseña directamente (sin verificar contraseña actual)
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(data.newPassword, saltRounds);

      await this.authRepository.updateUserPassword(data.userId, {
        passwordHash: hashedPassword,
        // Invalidar cualquier token de reset pendiente
        resetToken: undefined,
        resetExpiresAt: undefined,
      });

      // 7. Registrar evento de seguridad
      try {
        await this.securityEventRepository.create({
          userId: data.userId,
          eventType: SecurityEventType.PASSWORD_SET_BY_ADMIN,
          description: `Password set by administrator ${data.adminEmail || data.adminUserId}`,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: {
            adminUserId: data.adminUserId,
            adminEmail: data.adminEmail,
            targetUserId: data.userId,
            targetUserEmail: targetUser.email,
            action: 'password_set_by_admin',
          },
        });
      } catch (error) {
        // Log error pero no fallar la operación principal
        this.logger.warn('Failed to create security event for password set', {
          userId: data.userId,
          adminUserId: data.adminUserId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // 8. Registrar log de auditoría
      try {
        await this.auditRepository.create({
          userId: data.userId,
          action: AuditAction.PASSWORD_UPDATE,
          tableName: 'user_passwords',
          recordId: data.userId,
          oldValues: oldPasswordHash ? { passwordHash: '[REDACTED]' } : undefined,
          newValues: { passwordHash: '[REDACTED]' },
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        });
      } catch (error) {
        // Log error pero no fallar la operación principal
        this.logger.warn('Failed to create audit log for password set', {
          userId: data.userId,
          adminUserId: data.adminUserId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const duration = Date.now() - startTime;

      this.logger.info('Administrative password set completed successfully', {
        targetUserId: data.userId,
        targetUserEmail: targetUser.email,
        adminUserId: data.adminUserId,
        duration,
        passwordUpdated: true,
        tokensInvalidated: true,
        auditLogged: true,
        securityEventLogged: true,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Administrative password set failed', error as Error, {
        targetUserId: data.userId,
        adminUserId: data.adminUserId,
        duration,
        errorCode: error instanceof ValidationError ? error.code : 'SET_PASSWORD_FAILED',
      });

      // Re-lanzar errores de validación y negocio
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError ||
        error instanceof BusinessLogicError
      ) {
        throw error;
      }

      // Para otros errores, lanzar error genérico
      throw new BusinessLogicError('Failed to set user password', { userId: data.userId });
    }
  }

  private validateInputs(data: SetUserPasswordRequest): void {
    if (!data.userId) {
      throw new ValidationError('User ID is required', 'USER_ID_REQUIRED');
    }

    if (!data.newPassword) {
      throw new ValidationError('New password is required', 'NEW_PASSWORD_REQUIRED');
    }

    if (!data.adminUserId) {
      throw new ValidationError('Admin user ID is required', 'ADMIN_USER_ID_REQUIRED');
    }
  }

  /**
   * Valida la fortaleza de una contraseña.
   * Reutiliza la misma lógica de validación que UpdateUserPasswordUseCase.
   */
  private async validatePasswordStrength(password: string): Promise<{
    isValid: boolean;
    score: number;
    feedback: string[];
  }> {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 8) {
      score++;
    } else {
      feedback.push('Password should be at least 8 characters long');
    }

    if (password.length >= 12) {
      score++;
    }

    // Character complexity
    if (/[A-Z]/.test(password)) {
      score++;
    } else {
      feedback.push('Add uppercase letters');
    }

    if (/[a-z]/.test(password)) {
      score++;
    } else {
      feedback.push('Add lowercase letters');
    }

    if (/\d/.test(password)) {
      score++;
    } else {
      feedback.push('Add numbers');
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score++;
    } else {
      feedback.push('Add special characters');
    }

    // Common password patterns
    const commonPatterns = [/123456/, /password/i, /qwerty/i, /abc123/i, /admin/i, /letmein/i];

    const hasCommonPattern = commonPatterns.some((pattern) => pattern.test(password));
    if (hasCommonPattern) {
      score = Math.max(0, score - 2);
      feedback.push('Avoid common password patterns');
    }

    const isValid = score >= 4 && !hasCommonPattern;

    return {
      isValid,
      score,
      feedback,
    };
  }
}
