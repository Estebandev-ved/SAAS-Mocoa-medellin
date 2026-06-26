const db = require('../../db/config');
const instanceManager = require('../InstanceManager');
const { emitNewMessage } = require('../socketEmitter');
const orchestrator = require('../agents/orchestrator');
const paymentHandler = require('./paymentHandler');

async function handleMessage(sock, msg, negocioId) {
    try {
        const jid = msg.key.remoteJid;
        const esIndividual = jid?.endsWith('@s.whatsapp.net') || jid?.endsWith('@c.us') || jid?.endsWith('@lid');
        
        if (!msg.message || msg.key.fromMe || !esIndividual) {
            return;
        }

        const numero = msg.key.remoteJid.split('@')[0];
        let tipo = 'text';
        let texto = '';
        let imagenBase64 = null;

        if (msg.message.conversation) {
            texto = msg.message.conversation;
        } else if (msg.message.extendedTextMessage) {
            texto = msg.message.extendedTextMessage.text;
        } else if (msg.message.imageMessage) {
            tipo = 'image';
            texto = msg.message.imageMessage.caption || '[imagen]';
        } else if (msg.message.buttonsResponseMessage) {
            texto = msg.message.buttonsResponseMessage.selectedButtonId;
        } else if (msg.message.listResponseMessage) {
            texto = msg.message.listResponseMessage.singleSelectReply?.selectedRowId;
        }

        if (!texto && !imagenBase64) {
            return;
        }

        console.log(`[Handler] Mensaje de ${numero} en negocio ${negocioId}: ${texto?.substring(0, 50)}`);

        let [clientes] = await db.execute(
            'SELECT * FROM clientes WHERE negocio_id = ? AND whatsapp = ?',
            [negocioId, `+${numero}`]
        );

        let cliente;
        if (clientes.length === 0) {
            const [result] = await db.execute(
                'INSERT INTO clientes (negocio_id, nombre, whatsapp) VALUES (?, ?, ?)',
                [negocioId, `Cliente ${numero.slice(-4)}`, `+${numero}`]
            );
            cliente = { id: result.insertId, nombre: `Cliente ${numero.slice(-4)}`, whatsapp: `+${numero}` };
        } else {
            cliente = clientes[0];
        }

        let conversacion;
        const [convs] = await db.execute(
            'SELECT * FROM conversaciones WHERE negocio_id = ? AND cliente_id = ? ORDER BY id DESC LIMIT 1',
            [negocioId, cliente.id]
        );

        if (convs.length === 0) {
            const [result] = await db.execute(
                'INSERT INTO conversaciones (negocio_id, cliente_id, numero_cliente, ultimo_mensaje, ultimo_mensaje_at) VALUES (?, ?, ?, ?, NOW())',
                [negocioId, cliente.id, `+${numero}`, texto]
            );
            conversacion = { id: result.insertId };
        } else {
            conversacion = convs[0];
        }

        await db.execute(
            `INSERT INTO mensajes (conversacion_id, negocio_id, tipo, contenido, agente, respuesta_ia)
             VALUES (?, ?, 'entrada', ?, 'none', 0)`,
            [conversacion.id, negocioId, texto || '[imagen]']
        );

        if (tipo === 'image' && msg.message.imageMessage) {
            const [pedidos] = await db.execute(
                `SELECT p.* FROM pedidos p
                 WHERE p.negocio_id = ? AND p.cliente_id = ? AND p.estado = 'pago_enviado'
                 ORDER BY p.created_at DESC LIMIT 1`,
                [negocioId, cliente.id]
            );

            if (pedidos.length > 0) {
                try {
                    const buffer = await sock.downloadMediaMessage(msg.message.imageMessage);
                    if (!buffer) {
                        await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ No pude descargar la imagen. ¿Podrías enviarla de nuevo?' });
                        return;
                    }
                    const imagenBase = buffer.toString('base64');

                    if (!imagenBase || imagenBase.length < 1000) {
                        await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ La imagen es muy pequeña. ¿Podrías enviar una más clara?' });
                        return;
                    }

                    const resultado = await orchestrator.verificarPagoConImagen(imagenBase, negocioId, pedidos[0].total);

                    await db.execute(
                        `INSERT INTO mensajes (conversacion_id, negocio_id, tipo, contenido, respuesta_ia)
                         VALUES (?, ?, 'salida', ?, 1)`,
                        [conversacion.id, negocioId, resultado.valido ? '✅ Pago verificado. Tu pedido está en preparación.' : '⚠️ El pago no coincide. Por favor verifica el monto o envía un comprobante más claro.']
                    );

                    if (resultado.valido) {
                        await db.execute(
                            `UPDATE pedidos SET estado = 'pago_confirmado' WHERE id = ?`,
                            [pedidos[0].id]
                        );
                        await sock.sendMessage(msg.key.remoteJid, { text: '✅ Pago verificado correctamente. Tu pedido está en preparación.' });
                    } else {
                        const errorMsg = resultado.error || 'No pudimos verificar el pago';
                        await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ ${errorMsg}. Por favor intenta de nuevo o contacta al negocio.` });
                    }
                } catch (imgError) {
                    console.error('[Handler] Error procesando imagen:', imgError);
                    await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Tuve un problema al procesar la imagen. ¿Podrías enviarla de nuevo?' });
                }

                emitNewMessage(negocioId, { cliente, conversacion_id: conversacion.id, mensaje: texto, tipo });
                return;
            }
        }

        const [contextoRows] = await db.execute(
            `SELECT tipo, contenido, agente FROM mensajes 
             WHERE conversacion_id = ? ORDER BY created_at DESC LIMIT 10`,
            [conversacion.id]
        );

        const contexto = contextoRows.reverse().map(m => ({
            rol: m.tipo === 'entrada' ? 'cliente' : 'bot',
            contenido: m.contenido
        }));

        const respuesta = await orchestrator.procesarMensaje(texto, negocioId, cliente.id, contexto);

        await db.execute(
            `INSERT INTO mensajes (conversacion_id, negocio_id, tipo, contenido, agente, respuesta_ia)
             VALUES (?, ?, 'salida', ?, ?, 1)`,
            [conversacion.id, negocioId, respuesta.respuesta, respuesta.agente_usado]
        );

        await db.execute(
            `UPDATE conversaciones SET ultimo_mensaje = ?, ultimo_mensaje_at = NOW(), intencion_detectada = ? WHERE id = ?`,
            [respuesta.respuesta.substring(0, 255), respuesta.intencion, conversacion.id]
        );

        await sock.sendMessage(msg.key.remoteJid, { text: respuesta.respuesta });

        emitNewMessage(negocioId, { cliente, conversacion_id: conversacion.id, mensaje: texto, tipo, respuesta: respuesta.respuesta });

        await actualizarAnalytics(negocioId);

    } catch (error) {
        console.error(`[Handler] Error procesando mensaje:`, error.message);
        try {
            if (sock && msg?.key?.remoteJid) {
                await sock.sendMessage(msg.key.remoteJid, { 
                    text: 'Disculpa, tuve un problema. ¿Podrías intentarlo de nuevo?' 
                });
            }
        } catch (sendError) {
            console.error('[Handler] Error enviando mensaje de fallback:', sendError);
        }
    }
}

async function actualizarAnalytics(negocioId) {
    const hoy = new Date().toISOString().split('T')[0];

    try {
        const [existing] = await db.execute(
            'SELECT id FROM analytics_diario WHERE negocio_id = ? AND fecha = ?',
            [negocioId, hoy]
        );

        if (existing.length > 0) {
            await db.execute(
                'UPDATE analytics_diario SET total_mensajes = total_mensajes + 1 WHERE negocio_id = ? AND fecha = ?',
                [negocioId, hoy]
            );
        } else {
            await db.execute(
                'INSERT INTO analytics_diario (negocio_id, fecha, total_mensajes) VALUES (?, ?, 1)',
                [negocioId, hoy]
            );
        }
    } catch (error) {
        console.error('[Handler] Error actualizando analytics:', error);
    }
}

module.exports = { handleMessage };
