const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{titulo}}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080C10; font-family: system-ui, -apple-system, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #080C10; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #0D1117; border-radius: 12px; border: 1px solid #1E2A38;">
          <tr>
            <td style="padding: 30px; text-align: center; border-bottom: 1px solid #1E2A38;">
              <h1 style="color: #00FFD1; margin: 0; font-size: 28px; font-weight: 700;">ANTIGRAVITY</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #FFFFFF; margin: 0 0 20px 0; font-size: 22px;">{{titulo}}</h2>
              <div style="color: #8B949E; font-size: 16px; line-height: 1.6;">
                {{contenido}}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; text-align: center; border-top: 1px solid #1E2A38;">
              <p style="color: #484F58; margin: 0; font-size: 14px;">
                © 2026 Antigravity - Automatización para negocios colombianos
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

function getEmailContent(tipo, data) {
  const templates = {
    nuevo_pedido: {
      titulo: 'Nuevo Pedido Recibido',
      contenido: `
        <p style="color: #FFFFFF; font-size: 18px;">¡Tienes un nuevo pedido!</p>
        <div style="background-color: #161B22; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #00FFD1; margin: 0 0 10px 0;"><strong>Pedido #${data.numero_pedido}</strong></p>
          <p style="color: #FFFFFF; margin: 5px 0;"><strong>Cliente:</strong> ${data.cliente_nombre}</p>
          <p style="color: #FFFFFF; margin: 5px 0;"><strong>Total:</strong> $${data.total?.toLocaleString('es-CO') || '0'}</p>
          <p style="color: #FFFFFF; margin: 5px 0;"><strong>Método de pago:</strong> ${data.metodo_pago || 'No especificado'}</p>
        </div>
        <a href="${process.env.FRONTEND_URL || 'https://antigravity.co'}/dashboard/pedidos" style="display: inline-block; background-color: #00FFD1; color: #080C10; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 10px;">Ver Pedido</a>
      `
    },
    pago_confirmado: {
      titulo: 'Pago Confirmado',
      contenido: `
        <p style="color: #FFFFFF; font-size: 18px;">¡El pago ha sido verificado!</p>
        <div style="background-color: #161B22; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #00FFD1; margin: 0 0 10px 0;"><strong>Pedido #${data.numero_pedido}</strong></p>
          <p style="color: #FFFFFF; margin: 5px 0;"><strong>Monto:</strong> $${data.total?.toLocaleString('es-CO') || '0'}</p>
          <p style="color: #FFFFFF; margin: 5px 0;"><strong>Cliente:</strong> ${data.cliente_nombre}</p>
        </div>
      `
    },
    alerta_stock_bajo: {
      titulo: 'Alerta: Stock Bajo',
      contenido: `
        <p style="color: #FFFFFF; font-size: 18px;">Algunos productos tienen stock bajo</p>
        <div style="background-color: #161B22; padding: 20px; border-radius: 8px; margin: 20px 0;">
          ${data.productos?.map(p => `
            <p style="color: #FF6B6B; margin: 5px 0;"><strong>${p.nombre}:</strong> ${p.stock} unidades restantes</p>
          `).join('') || '<p>Revisa tu inventario</p>'}
        </div>
        <a href="${process.env.FRONTEND_URL || 'https://antigravity.co'}/dashboard/productos" style="display: inline-block; background-color: #FF6B6B; color: #080C10; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Ver Inventario</a>
      `
    },
    reporte_semanal: {
      titulo: 'Reporte Semanal',
      contenido: `
        <p style="color: #FFFFFF; font-size: 18px;">Resumen de tu negocio</p>
        <div style="background-color: #161B22; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #00FFD1; margin: 10px 0;"><strong>Ventas:</strong> $${data.ventas?.toLocaleString('es-CO') || '0'}</p>
          <p style="color: #00FFD1; margin: 10px 0;"><strong>Pedidos:</strong> ${data.pedidos || 0}</p>
          <p style="color: #00FFD1; margin: 10px 0;"><strong>Clientes nuevos:</strong> ${data.clientes_nuevos || 0}</p>
        </div>
      `
    },
    bienvenida_nuevo_negocio: {
      titulo: '¡Bienvenido a Antigravity!',
      contenido: `
        <p style="color: #FFFFFF; font-size: 18px;">Tu negocio ya está configurado</p>
        <p style="color: #8B949E; margin: 20px 0;">Comienza a vender por WhatsApp ahora mismo.</p>
        <a href="${process.env.FRONTEND_URL || 'https://antigravity.co'}/dashboard" style="display: inline-block; background-color: #00FFD1; color: #080C10; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Ir al Dashboard</a>
      `
    },
    cuenta_bloqueada: {
      titulo: 'Alerta de Cuenta',
      contenido: `
        <p style="color: #FF6B6B; font-size: 18px;">Tu cuenta requiere atención</p>
        <p style="color: #8B949E; margin: 20px 0;">${data.mensaje || 'Por favor contacta soporte'}</p>
        <a href="${process.env.FRONTEND_URL || 'https://antigravity.co'}/soporte" style="display: inline-block; background-color: #FF6B6B; color: #080C10; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Contactar Soporte</a>
      `
    }
  };

  const template = templates[tipo] || templates.nuevo_pedido;
  
  return {
    titulo: template.titulo,
    contenido: template.contenido
  };
}

async function sendEmail(tipo, email, data) {
  const { titulo, contenido } = getEmailContent(tipo, data);
  
  const html = EMAIL_TEMPLATE
    .replace('{{titulo}}', titulo)
    .replace('{{contenido}}', contenido);

  try {
    const info = await transporter.sendMail({
      from: `"Antigravity" <${process.env.SMTP_USER}>`,
      to: email,
      subject: titulo,
      html: html
    });
    
    console.log(`[EmailWorker] Email enviado: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EmailWorker] Error enviando email:`, error.message);
    throw error;
  }
}

function emailWorker(queue) {
  queue.process(async (job) => {
    const { tipo, email, data } = job.data;
    
    console.log(`[EmailWorker] Procesando: ${tipo} -> ${email}`);
    
    return await sendEmail(tipo, email, data);
  });
}

module.exports = { sendEmail, emailWorker, getEmailContent };
