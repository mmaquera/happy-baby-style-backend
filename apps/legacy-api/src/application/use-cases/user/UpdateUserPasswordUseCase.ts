import { LoggingDecorator } from '@hbs/logging';
import { 
  ValidationError, 
  NotFoundError, 
  UnauthorizedError, 
  BusinessLogicError 
} from '@domain/errors/DomainError';
import { UserValidationService } from '@application/validation/UserValidationService';
import { IAuthRepository } from '@domain/repositories/IAuthRepository';
import { IAuditRepository } from '@domain/repositories/IAuditRepository';
import { ISecurityEventRepository } from '@domain/repositories/ISecurityEventRepository';
import { IEmailService } from '@domain/interfaces/IEmailService';
import { ILogger } from '@hbs/logging';
import { SecurityEventType, AuditAction } from '@domain/entities/Audit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export interface UpdateUserPasswordRequest {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  ipAddress?: string;
  userAgent?: string;
}

export class UpdateUserPasswordUseCase {
  private userValidationService: UserValidationService;

  constructor(
    private authRepository: IAuthRepository,
    private auditRepository: IAuditRepository,
    private securityEventRepository: ISecurityEventRepository,
    private emailService: IEmailService,
    private logger: ILogger
  ) {
    this.userValidationService = new UserValidationService();
  }

  @LoggingDecorator.logUseCase({
    includeArgs: true,
    includeResult: false, // Don't log password data
    includeDuration: true,
    context: { useCase: 'UpdateUserPassword' }
  })
  async execute(data: UpdateUserPasswordRequest): Promise<void> {
    // Validate inputs using ValidationService
    this.validateInputs(data);

    // Validate new password using UserValidationService
    const passwordValidation = this.userValidationService.validatePassword(data.newPassword);
    if (!passwordValidation.isValid) {
      throw new ValidationError(
        `Password validation failed: ${passwordValidation.errors.join(', ')}`,
        'PASSWORD_VALIDATION_FAILED'
      );
    }

    // Check if passwords match
    if (data.newPassword !== data.confirmPassword) {
      throw new ValidationError('New password and confirmation do not match', 'PASSWORD_MISMATCH');
    }

    // Check if new password is different from current
    if (data.currentPassword === data.newPassword) {
      throw new BusinessLogicError('New password must be different from current password', { code: 'PASSWORD_SAME_AS_CURRENT' });
    }

    // Verify user exists and is active
    const user = await this.authRepository.getUserByEmail(data.email);
    if (!user) {
      throw new NotFoundError('User', data.email);
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account is deactivated');
    }

    // Verify current password
    const isCurrentPasswordValid = await this.authRepository.verifyPassword(user.id, data.currentPassword);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Get current password hash for audit
    const currentPassword = await this.authRepository.findUserPasswordByUserId(user.id);
    const oldPasswordHash = currentPassword?.passwordHash;

    // Update password
    await this.authRepository.updatePassword(user.id, data.newPassword);

    // Register security event
    try {
      await this.securityEventRepository.create({
        userId: user.id,
        eventType: SecurityEventType.PASSWORD_CHANGED,
        description: 'User changed their password',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: {
          userEmail: data.email,
          action: 'password_changed_by_user'
        }
      });
      } catch (error) {
        this.logger.warn('Failed to create security event for password change', {
          userId: user.id,
          email: data.email,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Register audit log
      try {
        await this.auditRepository.create({
          userId: user.id,
          action: AuditAction.PASSWORD_UPDATE,
          tableName: 'user_passwords',
          recordId: user.id,
          oldValues: oldPasswordHash ? { passwordHash: '[REDACTED]' } : undefined,
          newValues: { passwordHash: '[REDACTED]' },
          ipAddress: data.ipAddress,
          userAgent: data.userAgent
        });
      } catch (error) {
        this.logger.warn('Failed to create audit log for password change', {
          userId: user.id,
          email: data.email,
          error: error instanceof Error ? error.message : String(error)
        });
      }
  }

  private validateInputs(data: UpdateUserPasswordRequest): void {
    if (!data.email) {
      throw new ValidationError('Email is required', 'EMAIL_REQUIRED');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new ValidationError('Invalid email format', 'INVALID_EMAIL_FORMAT');
    }

    if (!data.currentPassword) {
      throw new ValidationError('Current password is required', 'CURRENT_PASSWORD_REQUIRED');
    }

    if (!data.newPassword) {
      throw new ValidationError('New password is required', 'NEW_PASSWORD_REQUIRED');
    }

    if (!data.confirmPassword) {
      throw new ValidationError('Password confirmation is required', 'CONFIRM_PASSWORD_REQUIRED');
    }
  }

  async validatePasswordStrength(password: string): Promise<{
    isValid: boolean;
    score: number; // 0-5
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
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /abc123/i,
      /admin/i,
      /letmein/i
    ];

    const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password));
    if (hasCommonPattern) {
      score = Math.max(0, score - 2);
      feedback.push('Avoid common password patterns');
    }

    const isValid = score >= 4 && !hasCommonPattern;

    return {
      isValid,
      score,
      feedback
    };
  }

  async generatePasswordResetToken(email: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      // 1. Validar parámetros de entrada
      if (!email) {
        throw new ValidationError('Email is required', 'EMAIL_REQUIRED');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ValidationError('Invalid email format', 'INVALID_EMAIL_FORMAT');
      }

      this.logger.info('Starting password reset token generation', { email });

      // 2. Verificar si el usuario existe
      const user = await this.authRepository.getUserByEmail(email);
      if (!user) {
        // Por seguridad, no revelar si el email existe o no
        this.logger.warn('Password reset requested for non-existent email', { 
          email,
          ipAddress: 'unknown', // Se puede pasar desde el contexto
          userAgent: 'unknown'
        });
        
        // Retornar éxito aunque no exista para no revelar información
        return 'success';
      }

      // 3. Generar token JWT seguro
      const jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
      const resetToken = jwt.sign(
        { 
          userId: user.id, 
          email, 
          type: 'password_reset',
          iat: Math.floor(Date.now() / 1000)
        },
        jwtSecret,
        { expiresIn: '1h' }
      );

      // 4. Almacenar token en base de datos
      await this.authRepository.updateUserPassword(user.id, {
        resetToken,
        resetExpiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hora
      });

      // 4.1 Registrar evento de seguridad para solicitud de reset
      try {
        await this.securityEventRepository.create({
          userId: user.id,
          eventType: SecurityEventType.PASSWORD_RESET_REQUESTED,
          description: 'User requested password reset',
          metadata: {
            userEmail: email,
            action: 'password_reset_requested'
          }
        });
      } catch (error) {
        this.logger.warn('Failed to create security event for password reset request', {
          userId: user.id,
          email,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // 5. Enviar email de reseteo
      try {
        const resetPasswordUrl = process.env.RESET_PASSWORD_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
        await this.emailService.sendPasswordResetEmail(
          email, 
          resetToken, 
          'Usuario', // Usar nombre genérico ya que getUserByEmail no retorna firstName
          `${resetPasswordUrl}/reset-password.html?token=${resetToken}`
        );
        
        const duration = Date.now() - startTime;
        this.logger.info('Password reset email sent successfully', { 
          email, 
          userId: user.id,
          duration,
          tokenGenerated: true
        });
      } catch (emailError) {
        const duration = Date.now() - startTime;
        this.logger.error('Failed to send password reset email', emailError as Error, { 
          email, 
          userId: user.id,
          duration,
          tokenGenerated: true
        });
        
        // No lanzar error aquí para no revelar que el usuario existe
        // El token ya fue generado y almacenado
      }

      return 'success';

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Password reset token generation failed', error as Error, {
        email,
        duration,
        errorCode: 'PASSWORD_RESET_TOKEN_GENERATION_FAILED'
      });

      // Re-lanzar errores de validación
      if (error instanceof ValidationError) {
        throw error;
      }

      // Para otros errores, lanzar error genérico
      throw new BusinessLogicError(
        'Failed to process password reset request',
        { email }
      );
    }
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // 1. Validar parámetros de entrada
      if (!token) {
        throw new ValidationError('Reset token is required', 'TOKEN_REQUIRED');
      }

      if (!newPassword) {
        throw new ValidationError('New password is required', 'NEW_PASSWORD_REQUIRED');
      }

      this.logger.info('Starting password reset with token', { 
        tokenLength: token.length,
        hasNewPassword: !!newPassword
      });

      // 2. Validar fuerza de contraseña
      const validation = await this.validatePasswordStrength(newPassword);
      if (!validation.isValid) {
        throw new ValidationError(
          `Password is too weak: ${validation.feedback.join(', ')}`, 
          'PASSWORD_TOO_WEAK'
        );
      }

      // 3. Verificar token JWT
      const jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
      let payload: any;
      
      try {
        payload = jwt.verify(token, jwtSecret) as any;
      } catch (jwtError) {
        this.logger.warn('Invalid JWT token provided for password reset', {
          error: jwtError instanceof Error ? jwtError.message : 'Unknown JWT error',
          tokenLength: token.length
        });
        throw new ValidationError('Invalid or expired token', 'INVALID_TOKEN');
      }

      // 4. Verificar tipo de token
      if (payload.type !== 'password_reset') {
        this.logger.warn('Invalid token type for password reset', {
          tokenType: payload.type,
          userId: payload.userId
        });
        throw new ValidationError('Invalid token type', 'INVALID_TOKEN_TYPE');
      }

      // 5. Verificar token en base de datos
      const userPassword = await this.authRepository.findUserPasswordByUserId(payload.userId);
      if (!userPassword?.resetToken || userPassword.resetToken !== token) {
        this.logger.warn('Token not found in database or mismatch', {
          userId: payload.userId,
          hasStoredToken: !!userPassword?.resetToken,
          tokenMatch: userPassword?.resetToken === token
        });
        throw new ValidationError('Invalid or expired token', 'INVALID_TOKEN');
      }

      // 6. Verificar expiración
      if (!userPassword.resetExpiresAt || userPassword.resetExpiresAt < new Date()) {
        this.logger.warn('Expired token used for password reset', {
          userId: payload.userId,
          expiresAt: userPassword.resetExpiresAt,
          currentTime: new Date()
        });
        throw new ValidationError('Token has expired', 'TOKEN_EXPIRED');
      }

      // 7. Obtener contraseña actual para auditoría
      const oldPasswordHash = userPassword?.passwordHash;

      // 8. Actualizar contraseña
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      
      await this.authRepository.updateUserPassword(payload.userId, {
        passwordHash: hashedPassword,
        resetToken: undefined,
        resetExpiresAt: undefined
      });

      // 9. Registrar evento de seguridad
      try {
        await this.securityEventRepository.create({
          userId: payload.userId,
          eventType: SecurityEventType.PASSWORD_RESET_COMPLETED,
          description: 'Password reset completed via token',
          metadata: {
            userEmail: payload.email,
            action: 'password_reset_completed',
            resetMethod: 'token'
          }
        });
      } catch (error) {
        this.logger.warn('Failed to create security event for password reset completion', {
          userId: payload.userId,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // 10. Registrar log de auditoría
      try {
        await this.auditRepository.create({
          userId: payload.userId,
          action: AuditAction.PASSWORD_RESET,
          tableName: 'user_passwords',
          recordId: payload.userId,
          oldValues: oldPasswordHash ? { passwordHash: '[REDACTED]' } : undefined,
          newValues: { passwordHash: '[REDACTED]' }
        });
      } catch (error) {
        this.logger.warn('Failed to create audit log for password reset', {
          userId: payload.userId,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      const duration = Date.now() - startTime;
      
      this.logger.info('Password reset completed successfully', { 
        userId: payload.userId,
        email: payload.email,
        duration,
        passwordUpdated: true,
        tokenInvalidated: true,
        auditLogged: true,
        securityEventLogged: true
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Password reset with token failed', error as Error, {
        tokenLength: token ? token.length : 0,
        hasNewPassword: !!newPassword,
        duration,
        errorCode: 'PASSWORD_RESET_WITH_TOKEN_FAILED'
      });

      // Re-lanzar errores de validación
      if (error instanceof ValidationError) {
        throw error;
      }

      // Para otros errores, lanzar error genérico
      throw new BusinessLogicError(
        'Failed to reset password',
        { tokenLength: token ? token.length : 0 }
      );
    }
  }
}