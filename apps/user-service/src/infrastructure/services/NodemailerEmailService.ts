import nodemailer, { Transporter } from 'nodemailer';
import {
  IEmailService,
  EmailServiceConfig,
  EmailSendResult,
} from '@domain/interfaces/IEmailService';
import { ILogger } from '@hbs/logging';
import { EmailTemplates } from './EmailTemplates';
import { DomainError } from '@domain/errors/DomainError';

/**
 * Implementación del servicio de email usando Nodemailer
 * Sigue principios de Clean Architecture - Infrastructure Layer
 */
export class NodemailerEmailService implements IEmailService {
  private transporter: Transporter;
  private config: EmailServiceConfig;
  private logger: ILogger;

  constructor(config: EmailServiceConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.transporter = this.createTransporter();
  }

  /**
   * Crea el transporter de Nodemailer
   */
  private createTransporter(): Transporter {
    try {
      const transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.auth.user,
          pass: this.config.auth.pass,
        },
        // Configuraciones adicionales para mejor deliverability
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 20000,
        rateLimit: 5,
        // Timeouts
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
      });

      this.logger.info('Nodemailer transporter created successfully', {
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        fromEmail: this.config.fromEmail,
      });

      return transporter;
    } catch (error) {
      this.logger.error('Failed to create Nodemailer transporter', error as Error, {
        host: this.config.host,
        port: this.config.port,
      });
      throw new Error('Failed to initialize email service');
    }
  }

  /**
   * Envía email de reseteo de contraseña
   */
  async sendPasswordResetEmail(
    email: string,
    token: string,
    userName: string,
    resetUrl?: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Validar parámetros
      this.validateEmailParameters(email, userName, token);

      // Construir URL de reseteo
      const fullResetUrl =
        resetUrl || `${this.config.resetPasswordUrl}/reset-password.html?token=${token}`;

      // Generar contenido del email
      const htmlContent = EmailTemplates.getPasswordResetTemplate(userName, fullResetUrl);
      const textContent = EmailTemplates.getPlainTextFromHtml(htmlContent);

      // Configurar opciones del email
      const mailOptions = {
        from: `"Happy Baby Style" <${this.config.fromEmail}>`,
        to: email,
        subject: '🔐 Restablecer tu contraseña - Happy Baby Style',
        text: textContent,
        html: htmlContent,
        // Headers adicionales para mejor deliverability
        headers: {
          'X-Mailer': 'Happy Baby Style Backend',
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
        },
      };

      // Enviar email
      const result = await this.transporter.sendMail(mailOptions);
      const duration = Date.now() - startTime;

      this.logger.info('Password reset email sent successfully', {
        email,
        userName,
        messageId: result.messageId,
        duration,
        resetUrl: fullResetUrl,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Failed to send password reset email', error as Error, {
        email,
        userName,
        duration,
        errorCode: 'PASSWORD_RESET_EMAIL_FAILED',
      });

      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Envía email de verificacion de email
   */
  async sendEmailVerificationEmail(
    email: string,
    _token: string,
    userName: string,
    verifyUrl: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      this.validateEmailParameters(email, userName);

      const htmlContent = EmailTemplates.getEmailVerificationTemplate(userName, verifyUrl);
      const textContent = EmailTemplates.getPlainTextFromHtml(htmlContent);

      const mailOptions = {
        from: `"Happy Baby Style" <${this.config.fromEmail}>`,
        to: email,
        subject: 'Verifica tu email - Happy Baby Style',
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Mailer': 'Happy Baby Style Backend',
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
        },
      };

      const result = await this.transporter.sendMail(mailOptions);
      const duration = Date.now() - startTime;

      this.logger.info('Email verification email sent successfully', {
        email,
        userName,
        messageId: result.messageId,
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Failed to send email verification email', error as Error, {
        email,
        userName,
        duration,
        errorCode: 'EMAIL_VERIFICATION_EMAIL_FAILED',
      });

      throw new Error('Failed to send email verification email');
    }
  }

  /**
   * Envía email de bienvenida
   */
  async sendWelcomeEmail(email: string, userName: string): Promise<void> {
    const startTime = Date.now();

    try {
      this.validateEmailParameters(email, userName);

      const loginUrl = `${this.config.frontendUrl}/login`;
      const htmlContent = EmailTemplates.getWelcomeTemplate(userName, loginUrl);
      const textContent = EmailTemplates.getPlainTextFromHtml(htmlContent);

      const mailOptions = {
        from: `"Happy Baby Style" <${this.config.fromEmail}>`,
        to: email,
        subject: '👶 ¡Bienvenido a Happy Baby Style!',
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Mailer': 'Happy Baby Style Backend',
          'X-Priority': '3',
        },
      };

      const result = await this.transporter.sendMail(mailOptions);
      const duration = Date.now() - startTime;

      this.logger.info('Welcome email sent successfully', {
        email,
        userName,
        messageId: result.messageId,
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Failed to send welcome email', error as Error, {
        email,
        userName,
        duration,
      });

      throw new Error('Failed to send welcome email');
    }
  }

  /**
   * Envía email de confirmación de pedido
   */
  async sendOrderConfirmationEmail(email: string, orderData: any): Promise<void> {
    const startTime = Date.now();

    try {
      this.validateEmailParameters(email, orderData.userName || 'Cliente');

      const htmlContent = EmailTemplates.getOrderConfirmationTemplate(
        orderData.userName || 'Cliente',
        orderData,
      );
      const textContent = EmailTemplates.getPlainTextFromHtml(htmlContent);

      const mailOptions = {
        from: `"Happy Baby Style" <${this.config.fromEmail}>`,
        to: email,
        subject: `📦 Confirmación de Pedido #${orderData.orderNumber || 'N/A'} - Happy Baby Style`,
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Mailer': 'Happy Baby Style Backend',
          'X-Priority': '3',
        },
      };

      const result = await this.transporter.sendMail(mailOptions);
      const duration = Date.now() - startTime;

      this.logger.info('Order confirmation email sent successfully', {
        email,
        orderNumber: orderData.orderNumber,
        messageId: result.messageId,
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Failed to send order confirmation email', error as Error, {
        email,
        orderData,
        duration,
      });

      throw new Error('Failed to send order confirmation email');
    }
  }

  /**
   * Verifica la configuración del servicio
   */
  async verifyConfiguration(): Promise<boolean> {
    try {
      await this.transporter.verify();

      this.logger.info('Email service configuration verified successfully', {
        host: this.config.host,
        port: this.config.port,
        fromEmail: this.config.fromEmail,
      });

      return true;
    } catch (error) {
      this.logger.error('Email service configuration verification failed', error as Error, {
        host: this.config.host,
        port: this.config.port,
        fromEmail: this.config.fromEmail,
      });

      return false;
    }
  }

  /**
   * Valida parámetros de email
   */
  private validateEmailParameters(email: string, userName: string, token?: string): void {
    if (!email || !email.trim()) {
      throw new Error('Email is required');
    }

    if (!userName || !userName.trim()) {
      throw new Error('User name is required');
    }

    if (token && !token.trim()) {
      throw new Error('Token is required');
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
  }

  /**
   * Cierra las conexiones del transporter
   */
  async close(): Promise<void> {
    try {
      this.transporter.close();
      this.logger.info('Email service connections closed');
    } catch (error) {
      this.logger.error('Error closing email service connections', error as Error);
    }
  }

  /**
   * Obtiene estadísticas del servicio
   */
  getStats(): { isConnected: boolean; config: Partial<EmailServiceConfig> } {
    return {
      isConnected: this.transporter.isIdle(),
      config: {
        host: this.config.host,
        port: this.config.port,
        fromEmail: this.config.fromEmail,
      },
    };
  }
}
