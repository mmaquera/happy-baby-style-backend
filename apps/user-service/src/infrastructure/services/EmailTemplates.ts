/**
 * Sistema de plantillas de email para Happy Baby Style
 * Implementa Clean Architecture - Infrastructure Layer
 */
export class EmailTemplates {
  /**
   * Plantilla para reseteo de contraseña
   * @param userName - Nombre del usuario
   * @param resetUrl - URL completa de reseteo
   * @param expirationHours - Horas de expiración del token
   */
  static getPasswordResetTemplate(
    userName: string,
    resetUrl: string,
    expirationHours: number = 1,
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer Contraseña - Happy Baby Style</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background-color: #ffffff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
          }
          .title {
            color: #333;
            font-size: 24px;
            margin-bottom: 20px;
          }
          .content {
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 20px 0;
            transition: background-color 0.3s;
          }
          .button:hover {
            background-color: #0056b3;
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            font-size: 14px;
            color: #6c757d;
            text-align: center;
          }
          .security-note {
            background-color: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">👶 Happy Baby Style</div>
            <h1 class="title">Restablecer tu Contraseña</h1>
          </div>
          
          <div class="content">
            <p>¡Hola <strong>${userName}</strong>!</p>
            
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Happy Baby Style.</p>
            
            <p>Para crear una nueva contraseña, haz clic en el siguiente botón:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">
                🔐 Restablecer Contraseña
              </a>
            </div>
            
            <div class="warning">
              <strong>⚠️ Importante:</strong> Este enlace expirará en ${expirationHours} hora${expirationHours > 1 ? 's' : ''} por seguridad.
            </div>
            
            <div class="security-note">
              <strong>🔒 Información de Seguridad:</strong><br>
              • Si no solicitaste este cambio, puedes ignorar este email de forma segura<br>
              • Tu contraseña actual seguirá siendo válida hasta que la cambies<br>
              • Nunca compartas este enlace con otras personas
            </div>
            
            <p>Si tienes problemas con el botón, copia y pega este enlace en tu navegador:</p>
            <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">
              ${resetUrl}
            </p>
          </div>
          
          <div class="footer">
            <p><strong>Happy Baby Style</strong> - Ropa y accesorios para bebés</p>
            <p>Este es un email automático, por favor no respondas a este mensaje.</p>
            <p>Si necesitas ayuda, contacta a nuestro equipo de soporte.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Plantilla para email de bienvenida
   * @param userName - Nombre del usuario
   * @param loginUrl - URL de login
   */
  static getWelcomeTemplate(userName: string, loginUrl: string): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Bienvenido a Happy Baby Style!</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background-color: #ffffff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
          }
          .welcome-title {
            color: #28a745;
            font-size: 26px;
            margin-bottom: 20px;
          }
          .button {
            display: inline-block;
            background-color: #28a745;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            margin: 20px 0;
          }
          .features {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .feature-item {
            margin: 10px 0;
            padding-left: 20px;
            position: relative;
          }
          .feature-item::before {
            content: "✅";
            position: absolute;
            left: 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">👶 Happy Baby Style</div>
            <h1 class="welcome-title">¡Bienvenido a nuestra familia!</h1>
          </div>
          
          <div class="content">
            <p>¡Hola <strong>${userName}</strong>!</p>
            
            <p>¡Estamos emocionados de tenerte como parte de la familia Happy Baby Style! 🎉</p>
            
            <p>Tu cuenta ha sido creada exitosamente. Ahora puedes:</p>
            
            <div class="features">
              <div class="feature-item">Explorar nuestra amplia selección de ropa para bebés</div>
              <div class="feature-item">Crear tu lista de deseos personalizada</div>
              <div class="feature-item">Recibir ofertas exclusivas y descuentos</div>
              <div class="feature-item">Hacer seguimiento de tus pedidos fácilmente</div>
              <div class="feature-item">Acceder a contenido especial para padres</div>
            </div>
            
            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">
                🛍️ Comenzar a Comprar
              </a>
            </div>
            
            <p>Si tienes alguna pregunta, nuestro equipo de atención al cliente está aquí para ayudarte.</p>
          </div>
          
          <div class="footer">
            <p><strong>¡Gracias por elegir Happy Baby Style!</strong></p>
            <p>Ropa y accesorios de calidad para los más pequeños de la casa.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Plantilla para confirmación de pedido
   * @param userName - Nombre del usuario
   * @param orderData - Datos del pedido
   */
  static getOrderConfirmationTemplate(userName: string, orderData: any): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmación de Pedido - Happy Baby Style</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background-color: #ffffff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
          }
          .order-number {
            background-color: #e3f2fd;
            border: 2px solid #2196f3;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            margin: 20px 0;
            font-size: 18px;
            font-weight: bold;
          }
          .order-details {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 5px 0;
            border-bottom: 1px solid #e9ecef;
          }
          .detail-label {
            font-weight: bold;
          }
          .total {
            font-size: 18px;
            font-weight: bold;
            color: #28a745;
            text-align: center;
            margin-top: 20px;
            padding: 15px;
            background-color: #d4edda;
            border-radius: 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">👶 Happy Baby Style</div>
            <h1>¡Pedido Confirmado!</h1>
          </div>
          
          <div class="content">
            <p>¡Hola <strong>${userName}</strong>!</p>
            
            <p>Tu pedido ha sido procesado exitosamente. Te enviaremos una actualización cuando esté en camino.</p>
            
            <div class="order-number">
              📦 Número de Pedido: ${orderData.orderNumber || 'N/A'}
            </div>
            
            <div class="order-details">
              <div class="detail-row">
                <span class="detail-label">Fecha del Pedido:</span>
                <span>${new Date().toLocaleDateString('es-ES')}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Método de Pago:</span>
                <span>${orderData.paymentMethod || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Dirección de Envío:</span>
                <span>${orderData.shippingAddress || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Tiempo Estimado de Entrega:</span>
                <span>${orderData.estimatedDelivery || '3-5 días hábiles'}</span>
              </div>
            </div>
            
            <div class="total">
              💰 Total: ${orderData.total || 'N/A'}
            </div>
            
            <p>Gracias por tu compra. ¡Esperamos que disfrutes tus productos!</p>
          </div>
          
          <div class="footer">
            <p><strong>Happy Baby Style</strong></p>
            <p>Si tienes alguna pregunta sobre tu pedido, no dudes en contactarnos.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Genera el texto plano de un email HTML
   * @param htmlContent - Contenido HTML
   */
  static getPlainTextFromHtml(htmlContent: string): string {
    return htmlContent
      .replace(/<[^>]*>/g, '') // Remover tags HTML
      .replace(/&nbsp;/g, ' ') // Reemplazar espacios no-break
      .replace(/&amp;/g, '&') // Reemplazar entidades HTML
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ') // Normalizar espacios
      .trim();
  }
}
