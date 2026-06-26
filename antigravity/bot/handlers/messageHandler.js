const mysql = require('mysql2/promise');
const axios = require('axios');
const whatsapp = require('../services/whatsapp');
const socket = require('../services/socket');
const paymentHandler = require('./paymentHandler');

const config = require('../../config');

let pool = null;

function obtenerPool() {
    if (!pool) {
        pool = mysql.createPool({
            host: config.mysql.host,
            user: config.mysql.user,
            password: config.mysql.password,
            database: config.mysql.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }
    return pool;
}

function limpiarJid(jid) {
    if (!jid) return null;
    return jid.split('@')[0].replace(/^57/, '');
}

async function procesarMensaje(mensaje, sock) {
    try {
        const jid = mensaje.key.remoteJid;
        const esIndividual = jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us') || jid.endsWith('@lid');
        
        if (!esIndividual) {
            console.log('[MessageHandler] Ignorando mensaje no individual (grupo, broadcast, newsletter, etc.):', jid);
            return;
        }

        if (mensaje.key.fromMe) {
            console.log('[MessageHandler] Ignorando mensaje propio');
            return;
        }

        const numero = whatsapp.extraerNumeroDeJid(jid);
        
        let textoMensaje = '';
        if (mensaje.message?.conversation) {
            textoMensaje = mensaje.message.conversation;
        } else if (mensaje.message?.extendedTextMessage?.text) {
            textoMensaje = mensaje.message.extendedTextMessage.text;
        } else if (mensaje.message?.imageMessage?.caption) {
            textoMensaje = mensaje.message.imageMessage.caption;
        }

        if (!textoMensaje && !mensaje.message?.imageMessage) {
            console.log('[MessageHandler] Mensaje vacío o no procesado');
            return;
        }

        const esImagen = !!mensaje.message?.imageMessage;
        let urlImagen = null;
        if (esImagen && mensaje.message.imageMessage.url) {
            urlImagen = mensaje.message.imageMessage.url;
        }

        console.log('[MessageHandler] Mensaje recibido de', numero, ':', textoMensaje || '[IMAGEN]');

        const negocioId = 1;

        const db = obtenerPool();

        let [clientes] = await db.execute(
            'SELECT * FROM clientes WHERE whatsapp = ? AND negocio_id = ?',
            [numero, negocioId]
        );

        let cliente;
        if (clientes.length === 0) {
            const [result] = await db.execute(
                'INSERT INTO clientes (negocio_id, nombre, whatsapp) VALUES (?, ?, ?)',
                [negocioId, `Cliente ${numero}`, numero]
            );
            console.log('[MessageHandler] Nuevo cliente creado:', numero);
            
            [clientes] = await db.execute(
                'SELECT * FROM clientes WHERE id = ?',
                [result.insertId]
            );
        }
        cliente = clientes[0];

        let [conversaciones] = await db.execute(
            'SELECT * FROM conversaciones WHERE cliente_id = ? AND activa = 1 ORDER BY updated_at DESC LIMIT 1',
            [cliente.id]
        );

        let conversacion;
        if (conversaciones.length === 0) {
            const [result] = await db.execute(
                'INSERT INTO conversaciones (negocio_id, cliente_id, mensajes, activa) VALUES (?, ?, ?, ?)',
                [negocioId, cliente.id, JSON.stringify([]), true]
            );
            console.log('[MessageHandler] Nueva conversación iniciada');
            
            [conversaciones] = await db.execute(
                'SELECT * FROM conversaciones WHERE id = ?',
                [result.insertId]
            );
        }
        conversacion = conversaciones[0];

        const historialMensajes = JSON.parse(conversacion.mensajes || '[]');
        const ultimos10 = historialMensajes.slice(-10);

        let respuestaBrain;
        let intencion = 'otro';

        try {
            const respuesta = await axios.post('http://localhost:8000/procesar', {
                mensaje: textoMensaje,
                contexto: ultimos10,
                negocio_id: negocioId,
                cliente_id: cliente.id
            }, {
                timeout: 30000
            });

            respuestaBrain = respuesta.data;
            intencion = respuestaBrain.intencion;
            console.log('[MessageHandler] Intención detectada:', intencion);
        } catch (error) {
            console.error('[MessageHandler] Error conectando con brain:', error.message);
            respuestaBrain = {
                intencion: 'otro',
                respuesta: 'Disculpa, estoy tengo problemas técnicos. Por favor intenta de nuevo en unos momentos.',
                datos_pedido: null,
                confianza: 0
            };
        }

        let respuestaTexto = respuestaBrain.respuesta;
        let datosPedido = respuestaBrain.datos_pedido;

        if (intencion === 'pago' || esImagen) {
            await paymentHandler.procesarPago(
                cliente.id,
                negocioId,
                sock,
                jid,
                textoMensaje,
                urlImagen
            );
            return;
        }

        if (intencion === 'pedido' && datosPedido) {
            await procesarPedido(cliente, negocioId, datosPedido, sock, jid, db);
            return;
        }

        if (intencion === 'estado_pedido') {
            await buscarYEnviarEstadoPedido(cliente.id, sock, jid, db);
        } else {
            await whatsapp.enviarMensaje(sock, jid, respuestaTexto);
        }

        const nuevoMensaje = {
            rol: 'cliente',
            contenido: textoMensaje,
            timestamp: new Date().toISOString()
        };

        const respuestaBot = {
            rol: 'bot',
            contenido: respuestaTexto,
            timestamp: new Date().toISOString()
        };

        historialMensajes.push(nuevoMensaje, respuestaBot);

        await db.execute(
            'UPDATE conversaciones SET mensajes = ?, intencion_detectada = ?, updated_at = NOW() WHERE id = ?',
            [JSON.stringify(historialMensajes), intencion, conversacion.id]
        );

        socket.emitirNuevoMensaje({
            id: conversacion.id,
            cliente_id: cliente.id,
            numero_whatsapp: numero,
            ultimo_mensaje: textoMensaje,
            intencion: intencion,
            updated_at: new Date().toISOString()
        }, negocioId);

        console.log('[MessageHandler] Mensaje procesado correctamente');

    } catch (error) {
        console.error('[MessageHandler] Error fatal:', error.message);
        console.error(error.stack);
    }
}

async function procesarPedido(cliente, negocioId, datosPedido, sock, numero, db) {
    try {
        console.log('[MessageHandler] Procesando pedido:', datosPedido);

        const productos = datosPedido.productos || [];
        if (productos.length === 0) {
            await whatsapp.enviarMensaje(sock, numero, 'No encontré productos en tu pedido. ¿Podrías especificar qué quieres comprar?');
            return;
        }

        const items = [];
        let subtotal = 0;

        for (const prod of productos) {
            const [productosDb] = await db.execute(
                'SELECT * FROM productos WHERE nombre LIKE ? AND negocio_id = ? AND activo = 1 LIMIT 1',
                [`%${prod.nombre}%`, negocioId]
            );

            if (productosDb.length === 0) {
                await whatsapp.enviarMensaje(sock, numero, `El producto "${prod.nombre}" no está disponible.`);
                return;
            }

            const producto = productosDb[0];

            if (producto.stock < prod.cantidad) {
                await whatsapp.enviarMensaje(sock, numero, `Lo sentimos, no hay suficiente stock de "${producto.nombre}". Disponible: ${producto.stock}`);
                return;
            }

            const itemSubtotal = producto.precio * prod.cantidad;
            subtotal += itemSubtotal;

            items.push({
                producto,
                cantidad: prod.cantidad,
                precio_unitario: producto.precio,
                subtotal: itemSubtotal
            });
        }

        const descuento = datosPedido.notas?.includes('descuento') ? subtotal * 0.1 : 0;
        const total = subtotal - descuento;

        const [resultPedido] = await db.execute(
            `INSERT INTO pedidos (negocio_id, cliente_id, numero_pedido, estado, metodo_pago, subtotal, descuento, total, direccion_entrega, notas)
             VALUES (?, ?, ?, 'pendiente_pago', ?, ?, ?, ?, ?, ?)`,
            [
                negocioId,
                cliente.id,
                await generarNumeroPedido(db, negocioId),
                datosPedido.metodo_pago || 'nequi',
                subtotal,
                descuento,
                total,
                datosPedido.direccion || null,
                datosPedido.notas || null
            ]
        );

        const pedidoId = resultPedido.insertId;

        for (const item of items) {
            await db.execute(
                'INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                [pedidoId, item.producto.id, item.cantidad, item.precio_unitario, item.subtotal]
            );

            await db.execute(
                'UPDATE productos SET stock = stock - ? WHERE id = ?',
                [item.cantidad, item.producto.id]
            );
        }

        const [pedidoCompleto] = await db.execute(
            `SELECT p.*, c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp 
             FROM pedidos p JOIN clientes c ON p.cliente_id = c.id 
             WHERE p.id = ?`,
            [pedidoId]
        );

        let mensajeResumen = `*🛒 PEDIDO CONFIRMADO*\n\n`;
        mensajeResumen += `*Número:* #AG-${pedidoId.toString().padStart(4, '0')}\n\n`;
        mensajeResumen += `*Productos:*\n`;
        for (const item of items) {
            mensajeResumen += `• ${item.producto.nombre} x${item.cantidad} = $${item.subtotal.toLocaleString()}\n`;
        }
        mensajeResumen += `\n*Subtotal:* $${subtotal.toLocaleString()}\n`;
        if (descuento > 0) {
            mensajeResumen += `*Descuento:* -$${descuento.toLocaleString()}\n`;
        }
        mensajeResumen += `*TOTAL:* $${total.toLocaleString()}\n\n`;
        
        if (datosPedido.direccion) {
            mensajeResumen += `*📍 Entrega:* ${datosPedido.direccion}\n\n`;
        }
        
        mensajeResumen += `*Método de pago:* ${datosPedido.metodo_pago || 'Nequi'}\n\n`;
        mensajeResumen += `Por favor envía el comprobante de pago cuando lo hagas.`;

        await whatsapp.enviarMensaje(sock, numero, mensajeResumen);

        const botonesPago = [
            { texto: '📱 Ya pagué' },
            { texto: '💳 Ver métodos de pago' },
            { texto: '❓ Dudas' }
        ];
        await whatsapp.enviarMensajeConBotones(sock, numero, '¿Ya realizaste el pago?', botonesPago);

        socket.emitirNuevoPedido(pedidoCompleto[0], negocioId);

        console.log('[MessageHandler] Pedido creado:', pedidoId);

    } catch (error) {
        console.error('[MessageHandler] Error procesando pedido:', error.message);
        await whatsapp.enviarMensaje(sock, numero, 'Hubo un error al procesar tu pedido. Por favor intenta de nuevo.');
    }
}

async function generarNumeroPedido(db, negocioId) {
    const [result] = await db.execute(
        'SELECT COUNT(*) as total FROM pedidos WHERE negocio_id = ?',
        [negocioId]
    );
    const numero = result[0].total + 1;
    return `#AG-${numero.toString().padStart(4, '0')}`;
}

async function buscarYEnviarEstadoPedido(clienteId, sock, numero, db) {
    try {
        const [pedidos] = await db.execute(
            `SELECT * FROM pedidos WHERE cliente_id = ? AND estado NOT IN ('cancelado', 'entregado') ORDER BY created_at DESC LIMIT 1`,
            [clienteId]
        );

        if (pedidos.length === 0) {
            await whatsapp.enviarMensaje(sock, numero, 'No tienes pedidos activos en este momento.');
            return;
        }

        const pedido = pedidos[0];
        const estadosEmoji = {
            'pendiente_pago': '⏳',
            'pago_enviado': '📤',
            'pago_confirmado': '✅',
            'en_preparacion': '📦',
            'enviado': '🚚',
            'entregado': '🎉'
        };

        const emoji = estadosEmoji[pedido.estado] || '📋';
        const mensaje = `${emoji} *Tu pedido ${pedido.numero_pedido}*\n\nEstado: ${pedido.estado.replace(/_/g, ' ')}\nTotal: $${pedido.total.toLocaleString()}`;

        await whatsapp.enviarMensaje(sock, numero, mensaje);

    } catch (error) {
        console.error('[MessageHandler] Error buscando estado de pedido:', error.message);
    }
}

module.exports = { procesarMensaje };
