import { ILogger } from '@hbs/logging';

/**
 * Interface para el servicio de envío de emails
 * Sigue principios de Clean Architecture - Domain Layer
 */
export interface IEmailService {
  /**
   * Envía email de reseteo de contraseña
   * @param email - Email del destinatario
   * @param token - Token de reseteo
   * @param userName - Nombre del usuario
   * @param resetUrl - URL completa de reseteo
   */
  sendPasswordResetEmail(
    email: string,
    token: string,
    userName: string,
    resetUrl: string,
  ): Promise<void>;

  /**
   * Envía email de bienvenida
   * @param email - Email del destinatario
   * @param userName - Nombre del usuario
   */
  sendWelcomeEmail(email: string, userName: string): Promise<void>;

  /**
   * Envía email de verificacion de email
   * @param email - Email del destinatario
   * @param token - Token de verificacion
   * @param userName - Nombre del usuario
   * @param verifyUrl - URL completa de verificacion
   */
  sendEmailVerificationEmail(
    email: string,
    token: string,
    userName: string,
    verifyUrl: string,
  ): Promise<void>;

  /**
   * Envía email de confirmación de pedido
   * @param email - Email del destinatario
   * @param orderData - Datos del pedido
   */
  sendOrderConfirmationEmail(email: string, orderData: any): Promise<void>;

  /**
   * Verifica la configuración del servicio
   * @returns Promise<boolean> - true si está configurado correctamente
   */
  verifyConfiguration(): Promise<boolean>;
}

/**
 * Configuración del servicio de email
 */
export interface EmailServiceConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  fromEmail: string;
  frontendUrl: string;
  resetPasswordUrl: string;
}

/**
 * Resultado del envío de email
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}
