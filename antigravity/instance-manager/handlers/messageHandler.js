const db = require('../../db/config');
const instanceManager = require('../InstanceManager');
const { emitNewMessage } = require('../socketEmitter');
const orchestrator = require('../agents/orchestrator');

async function handleMessage(sock, msg, negocioId) {
    try {
        const jid = msg.key.remoteJid;
        const esIndividual = jid?.endsWith('@s.whatsapp.net') || jid?.endsWith('@c.us') || jid?.endsWith('@lid');
        
        if (!msg.message || msg.key.fromMe || !esIndividual) {
            return;
        }

        // Evita responderle a mensajes "viejos" que WhatsApp entrega de golpe
        // al reconectar (los que llegaron mientras el bot estaba apagado o
        // reconectando). Sin este filtro, cada vez que cerrabas y volvías a
        // prender los servicios, el bot le contestaba a todos esos mensajes
        // atrasados como si acabaran de llegar — lo cual se ve como spam para
        // el cliente que ya ni se acuerda de haber escrito.
        const MENSAJE_MAX_ANTIGUEDAD_MS = parseInt(process.env.MENSAJE_MAX_ANTIGUEDAD_MS) || 2 * 60 * 1000; // 2 min
        const tsRaw = msg.messageTimestamp;
        const tsSegundos = (tsRaw && typeof tsRaw === 'object' && typeof tsRaw.toNumber === 'function')
            ? tsRaw.toNumber()
            : Number(tsRaw);
        if (tsSegundos && Date.now() - (tsSegundos * 1000) > MENSAJE_MAX_ANTIGUEDAD_MS) {
            console.log(`[Handler] Ignorando mensaje viejo de ${jid} (${new Date(tsSegundos * 1000).toISOString()}) — probablemente entregado tras una reconexión`);
            return;
        }

        const numero = msg.key.remoteJid.split('@')[0];
        const esLid = jid?.endsWith('@lid');
        let numeroResuelto = numero;

        // Si es lid, intentar resolver al teléfono real
        if (esLid) {
            try {
                const [existe] = await db.execute(
                    'SELECT whatsapp FROM clientes WHERE negocio_id = ? AND whatsapp LIKE ? LIMIT 1',
                    [negocioId, `%${numero}%`]
                );
                if (existe.length > 0) {
                    numeroResuelto = existe[0].whatsapp.replace('+', '');
                    console.log(`[Handler] Lid ${numero} resuelto a teléfono: ${numeroResuelto}`);
                }
            } catch {}
        }

        let tipo = 'text';
        let texto = '';

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

        if (!texto) {
            return;
        }

        console.log(`[Handler] Mensaje de ${numero} (jid: ${jid}) en negocio ${negocioId}: ${texto?.substring(0, 50)}`);

        // Cargar automatizaciones del negocio
        const autoConfig = await cargarAutomatizaciones(negocioId);

        // Buscar o crear cliente
        let [clientes] = await db.execute(
            'SELECT * FROM clientes WHERE negocio_id = ? AND whatsapp = ?',
            [negocioId, `+${numero}`]
        );

        let cliente;
        let esNuevo = false;
        if (clientes.length === 0) {
            esNuevo = true;

            // Si es lid, intentar resolver el teléfono real desde contactos de WhatsApp
            let whatsappReal = `+${numero}`;
            if (esLid && sock) {
                try {
                    const allContacts = Object.values(sock.store?.contacts || {});
                    const match = allContacts.find(c => c.id === jid || c.id?.includes(numero));
                    if (match?.id) {
                        const realNum = match.id.split('@')[0];
                        if (/^\d+$/.test(realNum) && realNum.length >= 10) {
                            whatsappReal = `+${realNum}`;
                            numeroResuelto = realNum;
                            console.log(`[Handler] Lid ${numero} resuelto a ${realNum}`);
                        }
                    }
                } catch {}
            }

            const [result] = await db.execute(
                'INSERT INTO clientes (negocio_id, nombre, whatsapp) VALUES (?, ?, ?)',
                [negocioId, `Cliente ${numero.slice(-4)}`, whatsappReal]
            );
            cliente = { id: result.insertId, nombre: `Cliente ${numero.slice(-4)}`, whatsapp: whatsappReal };

            // Enviar mensaje de bienvenida si está configurado
            if (autoConfig.bienvenida?.activo && autoConfig.bienvenida?.mensaje) {
                await sock.sendMessage(msg.key.remoteJid, { text: autoConfig.bienvenida.mensaje });
                await db.execute(
                    `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada)
                     VALUES (?, ?, 'salida', ?, 'bienvenida', 'bienvenida')`,
                    [negocioId, `+${numero}`, autoConfig.bienvenida.mensaje]
                );
            }
        } else {
            cliente = clientes[0];
        }

        // Verificar modo whitelist (después de tener el cliente)
        const [negocios] = await db.execute(
            'SELECT bot_modo, chat_whitelist FROM negocios WHERE id = ?',
            [negocioId]
        );
        const botModo = negocios[0]?.bot_modo || 'todos';
        const whitelist = (negocios[0]?.chat_whitelist || '').split(',').map(s => s.trim()).filter(Boolean);

        if (botModo === 'whitelist' && whitelist.length > 0) {
            const telefonoCliente = (cliente.whatsapp || '').replace('+', '');
            const permitido = whitelist.some(w =>
                w === numero || w === numeroResuelto || w === telefonoCliente ||
                numero.includes(w) || numeroResuelto.includes(w) || telefonoCliente.includes(w)
            );
            if (!permitido) {
                console.log(`[Handler] Whitelist rechaza: numero=${numero}, resuelto=${numeroResuelto}, telefono=${telefonoCliente}`);
                return;
            }
        }

        // Verificar si el cliente está bloqueado (spam)
        if (autoConfig.antiSpam?.activo) {
            const bloqueado = await verificarSpam(negocioId, `+${numero}`, autoConfig.antiSpam);
            if (bloqueado) {
                console.log(`[Handler] Cliente ${numero} bloqueado por spam`);
                return;
            }
        }

        // ===== FLUJO DE ONBOARDING: pedir nombre, email y consentimiento =====
        if (cliente.onboarding_estado && cliente.onboarding_estado !== 'completado') {
            if (cliente.onboarding_estado === 'pendiente') {
                // Primer mensaje: preguntar nombre
                const msgBienvenida = `¡Hola! Bienvenido/a. Para comenzar, ¿cuál es tu nombre completo?`;
                await sock.sendMessage(msg.key.remoteJid, { text: msgBienvenida });
                await db.execute(
                    'UPDATE clientes SET onboarding_estado = ?, nombre = ? WHERE id = ?',
                    ['nombre', 'Pendiente', cliente.id]
                );
                await db.execute(
                    `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada)
                     VALUES (?, ?, 'salida', ?, 'onboarding', 'onboarding')`,
                    [negocioId, `+${numero}`, msgBienvenida]
                );
                console.log(`[Handler] Onboarding: esperando nombre de ${numero}`);
                return;
            }

            if (cliente.onboarding_estado === 'nombre') {
                // Guardar nombre y preguntar email
                const nombreRecibido = texto.trim();
                if (nombreRecibido.length < 2 || nombreRecibido.length > 100) {
                    await sock.sendMessage(msg.key.remoteJid, { text: 'Por favor ingresa un nombre válido (mínimo 2 caracteres).' });
                    return;
                }
                await db.execute('UPDATE clientes SET nombre = ?, onboarding_estado = ? WHERE id = ?', [nombreRecibido, 'email', cliente.id]);
                const msgEmail = `Gracias, ${nombreRecibido}. Ahora, ¿cuál es tu correo electrónico?`;
                await sock.sendMessage(msg.key.remoteJid, { text: msgEmail });
                await db.execute(
                    `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada)
                     VALUES (?, ?, 'salida', ?, 'onboarding', 'onboarding')`,
                    [negocioId, `+${numero}`, msgEmail]
                );
                console.log(`[Handler] Onboarding: nombre "${nombreRecibido}" guardado, esperando email`);
                return;
            }

            if (cliente.onboarding_estado === 'email') {
                // Guardar email y preguntar consentimiento
                const emailRecibido = texto.trim().toLowerCase();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailRecibido)) {
                    await sock.sendMessage(msg.key.remoteJid, { text: 'Por favor ingresa un correo electrónico válido (ejemplo@correo.com).' });
                    return;
                }
                await db.execute('UPDATE clientes SET email = ?, onboarding_estado = ? WHERE id = ?', [emailRecibido, 'aceptacion', cliente.id]);

                const msgConsentimiento = `${cliente.nombre || nombreRecibido}, gracias por tu correo.

Antes de continuar, necesitamos tu consentimiento:

1️⃣ *Datos personales:* ¿Aceptas que guardemos tu nombre y correo para brindarte un mejor servicio?

2️⃣ *Marketing:* ¿Aceptas recibir correos promocionales, ofertas y campañas de marketing?

Responde:
• *A* o *Ambos* → Aceptas ambos
• *D* o *Datos* → Solo datos personales
• *N* o *No* → No acepto ninguno`;
                await sock.sendMessage(msg.key.remoteJid, { text: msgConsentimiento });
                await db.execute(
                    `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada)
                     VALUES (?, ?, 'salida', ?, 'onboarding', 'onboarding')`,
                    [negocioId, `+${numero}`, msgConsentimiento]
                );
                console.log(`[Handler] Onboarding: email "${emailRecibido}" guardado, esperando consentimiento`);
                return;
            }

            if (cliente.onboarding_estado === 'aceptacion') {
                // Procesar consentimiento
                const respuesta = texto.trim().toLowerCase();
                let aceptaDatos = 0;
                let aceptaMarketing = 0;

                if (['a', 'ambos', 'si', 'sí', 'acepto', 'yes', 'ok'].includes(respuesta)) {
                    aceptaDatos = 1;
                    aceptaMarketing = 1;
                } else if (['d', 'datos'].includes(respuesta)) {
                    aceptaDatos = 1;
                    aceptaMarketing = 0;
                } else if (['n', 'no', 'ninguno', 'nada'].includes(respuesta)) {
                    aceptaDatos = 0;
                    aceptaMarketing = 0;
                } else {
                    // Default: interpretar como datos solos si contiene algo razonable
                    if (respuesta.includes('dato') || respuesta.includes('servicio')) {
                        aceptaDatos = 1;
                    } else if (respuesta.includes('marketing') || respuesta.includes('correo') || respuesta.includes('promo')) {
                        aceptaDatos = 1;
                        aceptaMarketing = 1;
                    } else {
                        // Respuesta no reconocida, preguntar de nuevo
                        await sock.sendMessage(msg.key.remoteJid, {
                            text: 'No entendí tu respuesta. Por favor responde:\n• *A* o *Ambos* → Acepto ambos\n• *D* o *Datos* → Solo datos\n• *N* o *No* → No acepto'
                        });
                        return;
                    }
                }

                await db.execute(
                    'UPDATE clientes SET acepta_datos = ?, acepta_marketing = ?, fecha_aceptacion = NOW(), onboarding_estado = ? WHERE id = ?',
                    [aceptaDatos, aceptaMarketing, 'completado', cliente.id]
                );

                let msgConfirmacion;
                if (aceptaDatos && aceptaMarketing) {
                    msgConfirmacion = `¡Perfecto, ${cliente.nombre}! Hemos registrado tu consentimiento para datos y marketing. ✅

Ahora sí, ¿en qué puedo ayudarte?`;
                } else if (aceptaDatos) {
                    msgConfirmacion = `¡Perfecto, ${cliente.nombre}! Hemos registrado tu consentimiento para datos personales. ✅

Tus datos no serán usados para marketing. ¿En qué puedo ayudarte?`;
                } else {
                    msgConfirmacion = `Entendido, ${cliente.nombre}. No guardaremos tus datos ni te enviaremos marketing. ✅

¿En qué puedo ayudarte?`;
                }

                await sock.sendMessage(msg.key.remoteJid, { text: msgConfirmacion });
                await db.execute(
                    `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada)
                     VALUES (?, ?, 'salida', ?, 'onboarding', 'onboarding')`,
                    [negocioId, `+${numero}`, msgConfirmacion]
                );
                console.log(`[Handler] Onboarding completado: ${cliente.nombre} | datos=${aceptaDatos} marketing=${aceptaMarketing}`);

                // Reload client with new data
                [clientes] = await db.execute('SELECT * FROM clientes WHERE id = ?', [cliente.id]);
                cliente = clientes[0];
                // Continue to normal flow...
            }
        }

        // Buscar conversacion activa o crear nueva
        let [convs] = await db.execute(
            'SELECT * FROM conversaciones WHERE negocio_id = ? AND cliente_id = ? AND activa = 1 ORDER BY id DESC LIMIT 1',
            [negocioId, cliente.id]
        );

        let conversacion;
        if (convs.length === 0) {
            const [result] = await db.execute(
                'INSERT INTO conversaciones (negocio_id, cliente_id, activa) VALUES (?, ?, 1)',
                [negocioId, cliente.id]
            );
            conversacion = { id: result.insertId };
        } else {
            conversacion = convs[0];
        }

        // Guardar mensaje de entrada
        await db.execute(
            `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada)
             VALUES (?, ?, 'entrada', ?, 'none', '')`,
            [negocioId, `+${numero}`, texto]
        );

        // Si es imagen, intentar verificar pago
        if (tipo === 'image' && msg.message.imageMessage) {
            // Buscar pedido pendiente o con pago enviado
            const [pedidos] = await db.execute(
                `SELECT p.* FROM pedidos p
                 WHERE p.negocio_id = ? AND p.cliente_id = ? AND p.estado IN ('pendiente_pago', 'pago_enviado')
                 ORDER BY p.created_at DESC LIMIT 1`,
                [negocioId, cliente.id]
            );

            if (pedidos.length > 0) {
                try {
                    const buffer = await sock.downloadMediaMessage(msg.message);
                    if (!buffer) {
                        await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ No pude descargar la imagen. ¿Podrías enviarla de nuevo?' });
                        return;
                    }
                    const imagenBase = buffer.toString('base64');

                    if (!imagenBase || imagenBase.length < 1000) {
                        await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ La imagen es muy pequeña. ¿Podrías enviar una más clara?' });
                        return;
                    }

                    // Send "verifying" message
                    await sock.sendMessage(msg.key.remoteJid, { text: '🔍 Verificando tu comprobante de pago...' });

                    const resultado = await orchestrator.verificarPagoConImagen(imagenBase, negocioId, pedidos[0].total);

                    // Save payment image to order
                    try {
                        await db.execute(
                            `UPDATE pedidos SET imagen_pago = ? WHERE id = ?`,
                            [imagenBase.substring(0, 100000), pedidos[0].id]
                        );
                    } catch (e) { /* ignore */ }

                    if (resultado.valido) {
                        await db.execute(
                            `UPDATE pedidos SET estado = 'pago_confirmado', metodo_pago = ? WHERE id = ?`,
                            [resultado.banco || 'desconocido', pedidos[0].id]
                        );

                        const msgExito = `✅ *¡Pago confirmado!*\n\n`
                            + `📋 Pedido: *${pedidos[0].numero_pedido}*\n`
                            + `💰 Monto verificado: $${(resultado.monto || pedidos[0].total).toLocaleString('es-CO')}\n`
                            + `🏦 Banco: ${resultado.banco || 'No detectado'}\n\n`
                            + `Tu pedido está siendo preparado. Te notificamos cuando salga en camino. 🚚`;

                        await sock.sendMessage(msg.key.remoteJid, { text: msgExito });
                        await db.execute(
                            `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada)
                             VALUES (?, ?, 'salida', ?, 'pago', 'pago_confirmado')`,
                            [negocioId, `+${numero}`, msgExito]
                        );
                        console.log(`[Handler] Pago confirmado: pedido ${pedidos[0].numero_pedido}, monto $${resultado.monto}`);
                    } else {
                        const msgFallo = `⚠️ *No se pudo verificar el pago*\n\n`
                            + `Motivo: ${resultado.error || 'El monto no coincide con el pedido'}\n\n`
                            + `Pedido: *${pedidos[0].numero_pedido}*\n`
                            + `Total a pagar: *$${pedidos[0].total.toLocaleString('es-CO')}*\n\n`
                            + `Por favor verifica:\n`
                            + `• El monto sea exacto\n`
                            + `• La captura sea clara y completa\n`
                            + `• Vuelve a enviar la captura`;

                        await sock.sendMessage(msg.key.remoteJid, { text: msgFallo });
                        await db.execute(
                            `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada)
                             VALUES (?, ?, 'salida', ?, 'pago', 'pago_fallido')`,
                            [negocioId, `+${numero}`, msgFallo]
                        );
                    }

                    emitNewMessage(negocioId, { cliente, conversacion_id: conversacion.id, mensaje: texto, tipo });
                    return;
                } catch (imgError) {
                    console.error('[Handler] Error procesando imagen:', imgError);
                    await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Tuve un problema al procesar la imagen. ¿Podrías enviarla de nuevo?' });
                }
            }
        }

        // Obtener contexto de la conversacion
        const [contextoRows] = await db.execute(
            `SELECT tipo, contenido, agente_proceso FROM mensajes 
             WHERE negocio_id = ? AND numero_cliente = ? ORDER BY created_at DESC LIMIT 10`,
            [negocioId, `+${numero}`]
        );

        const contexto = contextoRows.reverse().map(m => ({
            rol: m.tipo === 'entrada' ? 'cliente' : 'bot',
            contenido: m.contenido
        }));

        // Agregar contexto del negocio y automatizaciones al contexto del IA
        if (autoConfig.agentes?.activo) {
            contexto.unshift({
                rol: 'sistema',
                contenido: `Negocio: ${autoConfig.nombre || 'Negocio'}. Agentes activos: ${autoConfig.agentes.lista?.map(a => a.nombre).join(', ') || 'Ninguno'}. Tono: ${autoConfig.tono || 'amigable'}`
            });
        }

        // Procesar con IA
        console.log(`[Handler] Llamando orchestrator para negocio ${negocioId}...`);
        const respuesta = await orchestrator.procesarMensaje(texto, negocioId, cliente.id, contexto);
        console.log(`[Handler] Respuesta IA: ${respuesta.intencion} | agente: ${respuesta.agente_usado} | tokens: ${respuesta.tokens_usados}`);
        console.log(`[Handler] Texto: ${respuesta.respuesta?.substring(0, 80)}`);

        // Guardar respuesta del bot
        await db.execute(
            `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada)
             VALUES (?, ?, 'salida', ?, ?, ?)`,
            [negocioId, `+${numero}`, respuesta.respuesta, respuesta.agente_usado, respuesta.intencion || '']
        );

        // Actualizar conversacion
        await db.execute(
            `UPDATE conversaciones SET intencion_detectada = ?, updated_at = NOW() WHERE id = ?`,
            [respuesta.intencion || '', conversacion.id]
        );

        // Enviar respuesta por WhatsApp
        await sock.sendMessage(msg.key.remoteJid, { text: respuesta.respuesta });

        // Si se creó un pedido, enviar confirmación estructurada + instrucciones de pago
        if (respuesta.pedido_creado) {
            const p = respuesta.pedido_creado;
            const itemsList = p.items.map(i => `  • ${i.nombre} x${i.cantidad} - $${i.subtotal.toLocaleString('es-CO')}`).join('\n');

            let msgPedido = `✅ *Pedido confirmado*\n\n`
                + `📋 Pedido: *${p.numero_pedido}*\n`
                + `📦 Productos:\n${itemsList}\n`
                + `💰 Total: *$${p.total.toLocaleString('es-CO')}*\n`;

            if (p.direccion_entrega) {
                msgPedido += `📍 Entrega: ${p.direccion_entrega}\n`;
            }

            msgPedido += `\n💳 *Métodos de pago:*\n`;
            if (p.nequi) msgPedido += `📱 Nequi: *${p.nequi}*\n`;
            if (p.bancolombia) msgPedido += `🏦 Bancolombia: *${p.bancolombia}*\n`;
            if (!p.nequi && !p.bancolombia) msgPedido += `Contacta al vendedor para opciones de pago.\n`;

            msgPedido += `\nUna vez realices el pago, envía la captura y la verificamos automáticamente. ✅`;

            await sock.sendMessage(msg.key.remoteJid, { text: msgPedido });
            await db.execute(
                `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada)
                 VALUES (?, ?, 'salida', ?, 'sistema', 'pedido_creado')`,
                [negocioId, `+${numero}`, msgPedido]
            );
            console.log(`[Handler] Confirmación de pedido ${p.numero_pedido} enviada a ${numero}`);
        }

        emitNewMessage(negocioId, { cliente, conversacion_id: conversacion.id, mensaje: texto, tipo, respuesta: respuesta.respuesta });

        await actualizarAnalytics(negocioId);

        // Track subscription usage
        try {
            const SubscriptionNotifier = require('../subscriptionNotifier');
            const notifier = new SubscriptionNotifier();
            await notifier.trackUsage(negocioId, 'mensaje');
        } catch (e) { /* ignore */ }

    } catch (error) {
        console.error(`[Handler] Error procesando mensaje:`, error.message);
        console.error(`[Handler] Stack:`, error.stack?.substring(0, 200));
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

async function cargarAutomatizaciones(negocioId) {
    const config = {
        bienvenida: { activo: false, mensaje: '' },
        agentes: { activo: false, lista: [] },
        tono: 'amigable',
        antiSpam: { activo: false, umbral: 10 },
        horario: { activo: false }
    };

    try {
        // Cargar configuración del negocio
        const [negocios] = await db.execute(
            `SELECT bot_nombre, bot_tono, bot_bienvenida, horario_activo_inicio, horario_activo_fin, mensaje_fuera_horario 
             FROM negocios WHERE id = ?`,
            [negocioId]
        );

        if (negocios.length > 0) {
            const n = negocios[0];
            config.nombre = n.bot_nombre;
            config.tono = n.bot_tono || 'amigable';
            if (n.bot_bienvenida) {
                config.bienvenida = { activo: true, mensaje: n.bot_bienvenida };
            }
            if (n.horario_activo_inicio && n.horario_activo_fin) {
                config.horario = {
                    activo: true,
                    inicio: n.horario_activo_inicio,
                    fin: n.horario_activo_fin,
                    mensaje_fuera: n.mensaje_fuera_horario
                };
            }
        }

        // Cargar automatizaciones de la tabla
        const [autos] = await db.execute(
            'SELECT tipo, activa, config FROM automatizaciones_config WHERE negocio_id = ?',
            [negocioId]
        );

        for (const auto of autos) {
            const cfg = typeof auto.config === 'string' ? JSON.parse(auto.config || '{}') : (auto.config || {});
            
            switch (auto.tipo) {
                case 'bienvenida':
                    config.bienvenida = { activo: auto.activa, mensaje: cfg.mensaje || config.bienvenida.mensaje };
                    break;
                case 'agentes':
                    config.agentes = { activo: auto.activa, lista: cfg.agentes || [] };
                    break;
                case 'anti_spam':
                    config.antiSpam = { activo: auto.activa, umbral: cfg.umbral || 10 };
                    break;
                case 'horario':
                    config.horario = { ...config.horario, activo: auto.activa, ...cfg };
                    break;
            }
        }

    } catch (error) {
        console.error('[Handler] Error cargando automatizaciones:', error.message);
    }

    return config;
}

async function verificarSpam(negocioId, numero, config) {
    try {
        const hace1Minuto = new Date();
        hace1Minuto.setMinutes(hace1Minuto.getMinutes() - 1);

        const [mensajes] = await db.execute(
            `SELECT COUNT(*) as total FROM mensajes 
             WHERE negocio_id = ? AND numero_cliente = ? AND tipo = 'entrada' AND created_at >= ?`,
            [negocioId, numero, hace1Minuto.toISOString()]
        );

        return (mensajes[0]?.total || 0) >= (config.umbral || 10);
    } catch (error) {
        return false;
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
