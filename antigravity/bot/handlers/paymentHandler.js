const axios = require('axios');
const nodemailer = require('nodemailer');
const whatsapp = require('../services/whatsapp');
const socket = require('../services/socket');

function obtenerPool() {
    const mysql = require('mysql2/promise');
    return mysql.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'antigravity',
        waitForConnections: true,
        connectionLimit: 10
    });
}

function crearTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

async function procesarPago(clienteId, negocioId, sock, whatsappNumero, mensaje, imagenUrl = null) {
    try {
        console.log(`[PaymentHandler] Procesando pago para cliente ${clienteId}`);
        
        const db = obtenerPool();
        
        const [negocios] = await db.execute(
            'SELECT * FROM negocios WHERE id = ?',
            [negocioId]
        );
        
        if (negocios.length === 0) {
            await whatsapp.enviarMensaje(sock, whatsappNumero, 'Error: Negocio no encontrado.');
            return;
        }
        
        const negocio = negocios[0];
        
        if (imagenUrl) {
            console.log('[PaymentHandler] Procesando imagen de comprobante');
            await procesarComprobanteImagen(sock, whatsappNumero, clienteId, negocioId, imagenUrl, db);
            return;
        }
        
        const mensajeLower = mensaje.toLowerCase();
        
        if (mensajeLower.includes('pago') || mensajeLower.includes('transferencia') || 
            mensajeLower.includes('comprobante') || mensajeLower.includes('ya pag')) {
            
            await enviarInstruccionesPago(sock, whatsappNumero, negocio, db);
            return;
        }
        
        const [pedidosPendientes] = await db.execute(
            `SELECT * FROM pedidos 
             WHERE cliente_id = ? AND negocio_id = ? AND estado = 'pendiente_pago'
             ORDER BY created_at DESC LIMIT 1`,
            [clienteId, negocioId]
        );
        
        if (pedidosPendientes.length > 0) {
            await enviarInstruccionesPago(sock, whatsappNumero, negocio, db, pedidosPendientes[0]);
        } else {
            await whatsapp.enviarMensaje(
                sock, 
                whatsappNumero, 
                'No tienes pedidos pendientes de pago en este momento.'
            );
        }
        
    } catch (error) {
        console.error('[PaymentHandler] Error:', error.message);
        await whatsapp.enviarMensaje(
            sock, 
            whatsappNumero, 
            'Hubo un error al procesar tu pago. Por favor intenta de nuevo.'
        );
    }
}

async function procesarComprobanteImagen(sock, whatsappNumero, clienteId, negocioId, imagenUrl, db) {
    try {
        const [pedidos] = await db.execute(
            `SELECT * FROM pedidos 
             WHERE cliente_id = ? AND negocio_id = ? AND estado = 'pendiente_pago'
             ORDER BY created_at DESC LIMIT 1`,
            [clienteId, negocioId]
        );
        
        if (pedidos.length === 0) {
            await whatsapp.enviarMensaje(
                sock, 
                whatsappNumero, 
                'No tienes pedidos pendientes para verificar el pago.'
            );
            return;
        }
        
        const pedido = pedidos[0];
        
        await whatsapp.enviarMensaje(
            sock, 
            whatsappNumero, 
            '📤 Verificando tu comprobante de pago...'
        );
        
        try {
            const respuesta = await axios.post('http://localhost:8000/verificar-pago', {
                imagen_url: imagenUrl,
                monto_esperado: parseFloat(pedido.total),
                pedido_id: pedido.id
            }, {
                timeout: 30000
            });
            
            const verificacion = respuesta.data;
            
            if (verificacion.valido) {
                await confirmarPago(sock, whatsappNumero, pedido, negocioId, db);
            } else {
                await whatsapp.enviarMensaje(
                    sock, 
                    whatsappNumero, 
                    `⚠️ El comprobante no parece válido o el monto no coincide.\n\n` +
                    `Monto esperado: $${pedido.total.toLocaleString()}\n` +
                    `Por favor envía una imagen más clara del comprobante.`
                );
            }
            
        } catch (error) {
            console.error('[PaymentHandler] Error verificando con IA:', error.message);
            
            await db.execute(
                'UPDATE pedidos SET estado = ? WHERE id = ?',
                ['pago_enviado', pedido.id]
            );
            
            await whatsapp.enviarMensaje(
                sock, 
                whatsappNumero, 
                '📤 Comprobante recibido. Lo verificaremos manualmente.\n\n' +
                `Tu pedido #${pedido.numero_pedido} está en revisión.`
            );
        }
        
    } catch (error) {
        console.error('[PaymentHandler] Error procesando imagen:', error.message);
    }
}

async function confirmarPago(sock, whatsappNumero, pedido, negocioId, db) {
    await db.execute(
        'UPDATE pedidos SET estado = ?, updated_at = NOW() WHERE id = ?',
        ['pago_confirmado', pedido.id]
    );
    
    const [cliente] = await db.execute(
        'SELECT * FROM clientes WHERE id = ?',
        [pedido.cliente_id]
    );
    
    const [negocio] = await db.execute(
        'SELECT * FROM negocios WHERE id = ?',
        [negocioId]
    );
    
    const mensajeConfirmacion = `✅ *PAGO CONFIRMADO*\n\n` +
        `Pedido: ${pedido.numero_pedido}\n` +
        `Monto: $${pedido.total.toLocaleString()}\n\n` +
        `📦 Tu pedido está siendo preparado.\n` +
        `Te avisaremos cuando esté listo para envío.`;
    
    await whatsapp.enviarMensaje(sock, whatsappNumero, mensajeConfirmacion);
    
    socket.emitirEstadoCambiado(pedido.id, 'pago_confirmado', negocioId);
    
    await notificarPagoConfirmado(negocio[0].email_dueno, pedido, cliente[0]);
    
    await actualizarAnalytics(negocioId, db);
    
    console.log(`[PaymentHandler] Pago confirmado para pedido ${pedido.numero_pedido}`);
}

async function enviarInstruccionesPago(sock, whatsappNumero, negocio, db, pedido = null) {
    let mensaje = '*💳 INSTRUCCIONES DE PAGO*\n\n';
    
    if (negocio.whatsapp) {
        mensaje += `📱 *Nequi:* ${negocio.whatsapp}\n`;
    }
    mensaje += `🏦 *Bancolombia:* Cuenta de ahorros 123456789\n`;
    mensaje += `💵 *Efectivo:* Contraentrega\n\n`;
    
    if (pedido) {
        mensaje += `*Tu pedido:* ${pedido.numero_pedido}\n`;
        mensaje += `*Total a pagar:* $${pedido.total.toLocaleString()}\n\n`;
    }
    
    mensaje += `Envía el comprobante cuando realices el pago.`;
    
    await whatsapp.enviarMensaje(sock, whatsappNumero, mensaje);
}

async function notificarNuevoPedido(emailDueno, pedido, cliente) {
    if (!emailDueno) return;
    
    try {
        const transporter = crearTransporter();
        
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0f; color: #fff; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: #12121a; border-radius: 16px; padding: 30px; border: 1px solid #00D9FF20; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { color: #00D9FF; margin: 0; font-size: 28px; }
                .badge { background: #00D9FF; color: #000; padding: 8px 16px; border-radius: 8px; font-weight: bold; display: inline-block; margin-top: 10px; }
                .cliente { background: #1a1a24; padding: 20px; border-radius: 12px; margin: 20px 0; }
                .cliente h3 { color: #00D9FF; margin-top: 0; }
                .productos { margin: 20px 0; }
                .producto { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #2a2a3a; }
                .producto:last-child { border-bottom: none; }
                .total { font-size: 24px; color: #00D9FF; text-align: right; margin: 20px 0; font-weight: bold; }
                .boton { display: inline-block; background: #00D9FF; color: #000; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🛒 NUEVO PEDIDO</h1>
                    <span class="badge">${pedido.numero_pedido}</span>
                </div>
                
                <div class="cliente">
                    <h3>📱 Cliente</h3>
                    <p><strong>Nombre:</strong> ${cliente.nombre}</p>
                    <p><strong>WhatsApp:</strong> ${cliente.whatsapp}</p>
                </div>
                
                ${pedido.direccion_entrega ? `<div class="cliente"><h3>📍 Entrega</h3><p>${pedido.direccion_entrega}</p></div>` : ''}
                
                <div class="productos">
                    <h3>📦 Productos</h3>
                    ${pedido.items ? pedido.items.map(item => `
                        <div class="producto">
                            <span>${item.producto_nombre} x${item.cantidad}</span>
                            <span>$${item.subtotal.toLocaleString()}</span>
                        </div>
                    `).join('') : '<p>Cargando productos...</p>'}
                </div>
                
                <div class="total">
                    TOTAL: $${pedido.total.toLocaleString()}
                </div>
                
                <div style="text-align: center;">
                    <a href="#" class="boton">Ver en Panel</a>
                </div>
                
                <div class="footer">
                    <p>ANTIGRAVITY - Sistema de Automatización</p>
                </div>
            </div>
        </body>
        </html>
        `;
        
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: emailDueno,
            subject: `🛒 Nuevo pedido ${pedido.numero_pedido} - $${pedido.total.toLocaleString()}`,
            html: htmlContent
        });
        
        console.log(`[Email] Notificación de nuevo pedido enviada a ${emailDueno}`);
        
    } catch (error) {
        console.error('[Email] Error enviando notificación:', error.message);
    }
}

async function notificarPagoConfirmado(emailDueno, pedido, cliente) {
    if (!emailDueno) return;
    
    try {
        const transporter = crearTransporter();
        
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0f; color: #fff; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: #12121a; border-radius: 16px; padding: 30px; border: 1px solid #00FF8820; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { color: #00FF88; margin: 0; font-size: 28px; }
                .badge { background: #00FF88; color: #000; padding: 8px 16px; border-radius: 8px; font-weight: bold; display: inline-block; margin-top: 10px; }
                .info { background: #1a1a24; padding: 20px; border-radius: 12px; margin: 20px 0; }
                .total { font-size: 24px; color: #00FF88; text-align: center; margin: 20px 0; font-weight: bold; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✅ PAGO CONFIRMADO</h1>
                    <span class="badge">${pedido.numero_pedido}</span>
                </div>
                
                <div class="info">
                    <p><strong>Cliente:</strong> ${cliente.nombre}</p>
                    <p><strong>WhatsApp:</strong> ${cliente.whatsapp}</p>
                    <p><strong>Método de pago:</strong> ${pedido.metodo_pago || 'No especificado'}</p>
                </div>
                
                <div class="total">
                    $${pedido.total.toLocaleString()}
                </div>
                
                <p style="text-align: center; color: #aaa;">El pedido está siendo preparado.</p>
                
                <div class="footer">
                    <p>ANTIGRAVITY - Sistema de Automatización</p>
                </div>
            </div>
        </body>
        </html>
        `;
        
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: emailDueno,
            subject: `✅ Pago confirmado ${pedido.numero_pedido}`,
            html: htmlContent
        });
        
        console.log(`[Email] Notificación de pago confirmado enviada a ${emailDueno}`);
        
    } catch (error) {
        console.error('[Email] Error:', error.message);
    }
}

async function recordatorioCliente(sock, whatsapp, pedido, db) {
    try {
        const mensaje = `⏰ *RECORDATORIO DE PAGO*\n\n` +
            `Tienes un pedido pendiente de pago:\n` +
            `*Pedido:* ${pedido.numero_pedido}\n` +
            `*Total:* $${pedido.total.toLocaleString()}\n\n` +
            `Por favor envía el comprobante para confirmar tu pedido.`;
        
        await whatsapp.enviarMensaje(sock, whatsapp, mensaje);
        
        console.log(`[PaymentHandler] Recordatorio enviado a ${whatsapp}`);
        
    } catch (error) {
        console.error('[PaymentHandler] Error enviando recordatorio:', error.message);
    }
}

async function actualizarAnalytics(negocioId, db) {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        
        const [pedidosHoy] = await db.execute(
            `SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as ventas
             FROM pedidos
             WHERE negocio_id = ? AND DATE(created_at) = ? AND estado NOT IN ('cancelado', 'pendiente_pago')`,
            [negocioId, hoy]
        );
        
        const [mensajesHoy] = await db.execute(
            `SELECT COUNT(*) as total FROM conversaciones
             WHERE negocio_id = ? AND DATE(updated_at) = ?`,
            [negocioId, hoy]
        );
        
        const pedidos = parseInt(pedidosHoy[0].total) || 0;
        const mensajes = parseInt(mensajesHoy[0].total) || 0;
        const tasa = mensajes > 0 ? (pedidos / mensajes * 100) : 0;
        
        await db.execute(
            `INSERT INTO analytics_diario (negocio_id, fecha, total_mensajes, total_pedidos, total_ventas, tasa_conversion)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             total_mensajes = VALUES(total_mensajes),
             total_pedidos = VALUES(total_pedidos),
             total_ventas = VALUES(total_ventas),
             tasa_conversion = VALUES(tasa_conversion)`,
            [negocioId, hoy, mensajes, pedidos, parseFloat(pedidosHoy[0].ventas), tasa]
        );
        
        console.log(`[Analytics] Actualizado para ${hoy}`);
        
    } catch (error) {
        console.error('[Analytics] Error:', error.message);
    }
}

module.exports = {
    procesarPago,
    notificarNuevoPedido,
    notificarPagoConfirmado,
    recordatorioCliente,
    actualizarAnalytics
};
