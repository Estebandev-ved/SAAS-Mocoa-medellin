const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { firmaValida } = require('../services/metaWebhook');
const { cifrarSecreto } = require('../services/secretos');
const { PREFIJO_CLIENTE, enviarInstagram, enviarRespuestaPrivada, responderComentario } = require('../services/instagramEnvio');   // prefijo corto: `clientes.whatsapp` es VARCHAR(20)

// Instagram webhook verification
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Antes: `a && b || 'texto'` era siempre verdadero (cualquiera "verificaba" el webhook). Ahora el token debe coincidir.
    const esperado = process.env.INSTAGRAM_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || 'antigravity_ig_verify';
    if (mode === 'subscribe' && token === esperado) {
        console.log('[Instagram] Webhook verified');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Instagram webhook handler
router.post('/webhook', async (req, res) => {
    try {
        // Solo Meta puede enviar eventos: se valida la firma sobre el cuerpo crudo con el secreto de la app.
        // Sin META_APP_SECRET no se puede validar: en producción se rechaza (mejor sin respuesta que a un falso).
        const secreto = process.env.META_APP_SECRET;
        if (secreto) {
            if (!firmaValida(req.rawBody, req.get ? req.get('x-hub-signature-256') : req.headers['x-hub-signature-256'], secreto)) {
                console.warn('[Instagram] Webhook rechazado: firma inválida');
                return res.sendStatus(403);
            }
        } else if (process.env.NODE_ENV === 'production') {
            console.error('[Instagram] Webhook rechazado: falta META_APP_SECRET para validar la firma');
            return res.sendStatus(403);
        }

        const body = req.body;

        if (body.object === 'instagram') {
            for (const entry of body.entry || []) {
                for (const event of entry.messaging || []) {
                    await handleInstagramMessage(event, entry.id);
                }
                for (const change of entry.changes || []) {
                    if (change.field === 'comments') await handleInstagramComment(change.value, entry.id);
                }
            }
        }

        res.status(200).send('EVENT_RECEIVED');

    } catch (error) {
        console.error('[Instagram] Webhook error:', error);
        res.status(200).send('EVENT_RECEIVED');
    }
});

// Connect Instagram account
router.post('/connect', verificarAuth, async (req, res) => {
    try {
        const { page_id, access_token } = req.body;
        const negocioId = req.negocio.id;

        if (!page_id || !access_token) {
            return res.status(400).json({ error: 'Page ID y Access Token requeridos' });
        }

        // Validate with Instagram Graph API
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${page_id}?fields=instagram_business_account{id,name}&access_token=${access_token}`
        );
        const data = await response.json();

        if (data.error) {
            return res.status(400).json({ error: 'Token inválido o sin acceso a Instagram' });
        }

        const igAccount = data.instagram_business_account;

        // Save to database
        await db.execute(
            'UPDATE negocios SET instagram_token = ?, instagram_user_id = ?, instagram_nombre = ? WHERE id = ?',
            [cifrarSecreto(access_token), igAccount?.id || page_id, igAccount?.name || 'Instagram', negocioId]
        );

        res.json({
            success: true,
            account: {
                id: igAccount?.id || page_id,
                nombre: igAccount?.name || 'Instagram'
            }
        });

    } catch (error) {
        console.error('[Instagram] Error connecting:', error);
        res.status(500).json({ error: 'Error conectando Instagram' });
    }
});

// Get Instagram status
router.get('/status', verificarAuth, async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const [negocios] = await db.execute(
            'SELECT instagram_token, instagram_user_id, instagram_nombre FROM negocios WHERE id = ?',
            [negocioId]
        );

        const negocio = negocios[0];

        res.json({
            connected: !!negocio?.instagram_token,
            user_id: negocio?.instagram_user_id || null,
            nombre: negocio?.instagram_nombre || null,
            has_token: !!negocio?.instagram_token
        });

    } catch (error) {
        console.error('[Instagram] Error status:', error);
        res.status(500).json({ error: 'Error obteniendo estado' });
    }
});

// Disconnect Instagram
router.post('/disconnect', verificarAuth, async (req, res) => {
    try {
        const negocioId = req.negocio.id;

        await db.execute(
            'UPDATE negocios SET instagram_token = NULL, instagram_user_id = NULL, instagram_nombre = NULL WHERE id = ?',
            [negocioId]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('[Instagram] Error disconnecting:', error);
        res.status(500).json({ error: 'Error desconectando' });
    }
});

// Handle incoming Instagram message
async function handleInstagramMessage(event, entryId) {
    try {
        const senderId = event.sender?.id;
        const message = event.message;
        const text = message?.text || '';

        if (!senderId || !text) return;
        // Eco de un mensaje que mandamos nosotros: se ignora (si no, el bot se respondería a sí mismo).
        if (message?.is_echo) return;

        // El negocio es la cuenta que RECIBE el mensaje (entry.id / recipient.id), no quien lo envía.
        const cuentaId = entryId || event.recipient?.id;
        if (!cuentaId) return;
        const [negocios] = await db.execute(
            'SELECT id FROM negocios WHERE instagram_user_id = ?',
            [cuentaId]
        );

        if (negocios.length === 0) return;

        const negocioId = negocios[0].id;

        // Get or create client
        let [clientes] = await db.execute(
            'SELECT id, nombre FROM clientes WHERE negocio_id = ? AND whatsapp = ?',
            [negocioId, `${PREFIJO_CLIENTE}${senderId}`]
        );

        let clienteId;
        const clienteNuevo = clientes.length === 0;
        if (clienteNuevo) {
            const [result] = await db.execute(
                'INSERT INTO clientes (negocio_id, nombre, whatsapp) VALUES (?, ?, ?)',
                [negocioId, 'Instagram User', `${PREFIJO_CLIENTE}${senderId}`]
            );
            clienteId = result.insertId;
        } else {
            clienteId = clientes[0].id;
        }

        // La conversación (una fila por cliente activo) es lo que lista la pantalla Mensajes.
        let [convs] = await db.execute(
            'SELECT id FROM conversaciones WHERE negocio_id = ? AND cliente_id = ? AND activa = 1 ORDER BY id DESC LIMIT 1',
            [negocioId, clienteId]
        );
        let conversacionId;
        if (convs.length === 0) {
            const [nueva] = await db.execute('INSERT INTO conversaciones (negocio_id, cliente_id, activa) VALUES (?, ?, 1)', [negocioId, clienteId]);
            conversacionId = nueva.insertId;
        } else {
            conversacionId = convs[0].id;
        }

        // Save incoming message
        await db.execute(
            'INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido) VALUES (?, ?, ?, ?)',
            [negocioId, `${PREFIJO_CLIENTE}${senderId}`, 'entrada', text]
        );

        // ¿Hay un flujo esperando su respuesta (p. ej. el que empezó con su comentario) o que arranque con este mensaje?
        try {
            const flujos = require('../services/flujosEjecucion');
            const enviarFlujo = async (t) => {
                await db.execute(
                    'INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada) VALUES (?, ?, ?, ?, ?, ?)',
                    [negocioId, `${PREFIJO_CLIENTE}${senderId}`, 'salida', t, 'flujo', 'flujo']
                );
                const envio = await enviarInstagram(db, negocioId, senderId, t);
                if (!envio.ok) console.error(`[Instagram] No se pudo enviar un paso del flujo (negocio ${negocioId}): ${envio.motivo} ${envio.detalle || ''}`);
            };
            const r = await flujos.manejarMensaje({
                negocioId, cliente: { id: clienteId, nombre: clientes[0]?.nombre || 'Instagram User', total_gastado: 0, total_pedidos: 0 },
                texto: text, esNuevo: clienteNuevo, enviar: enviarFlujo,
            });
            if (r && r.manejado) {
                await db.execute('UPDATE conversaciones SET updated_at = NOW() WHERE id = ?', [conversacionId]);
                return;
            }
        } catch (e) {
            // Un fallo del motor de flujos nunca deja al cliente sin respuesta: sigue la IA de siempre.
            console.error('[Instagram] Error en flujos:', e.message);
        }

        // Process with orchestrator
        const orchestrator = require('../../instance-manager/agents/orchestrator');
        const contextoRows = await db.execute(
            'SELECT tipo, contenido FROM mensajes WHERE negocio_id = ? AND numero_cliente = ? ORDER BY created_at DESC LIMIT 10',
            [negocioId, `${PREFIJO_CLIENTE}${senderId}`]
        );
        const contexto = (contextoRows[0] || []).reverse().map(m => ({
            rol: m.tipo === 'entrada' ? 'cliente' : 'bot',
            contenido: m.contenido
        }));

        const respuesta = await orchestrator.procesarMensaje(text, negocioId, clienteId, contexto);

        // Save response
        await db.execute(
            'INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada) VALUES (?, ?, ?, ?, ?, ?)',
            [negocioId, `${PREFIJO_CLIENTE}${senderId}`, 'salida', respuesta.respuesta, respuesta.agente_usado, respuesta.intencion || '']
        );

        await db.execute('UPDATE conversaciones SET intencion_detectada = ?, updated_at = NOW() WHERE id = ?', [respuesta.intencion || '', conversacionId]);

        // Send via Instagram Graph API
        const envio = await enviarInstagram(db, negocioId, senderId, respuesta.respuesta);
        if (!envio.ok) console.error(`[Instagram] No se pudo responder (negocio ${negocioId}): ${envio.motivo} ${envio.detalle || ''}`);

    } catch (error) {
        console.error('[Instagram] Error handling message:', error);
    }
}

// Comentarios ya atendidos (Meta reintenta los avisos que no confirmamos a tiempo); solo en memoria, de sobra para los reintentos.
const comentariosAtendidos = new Map();
const MAX_COMENTARIOS_RECORDADOS = 2000;
const variante = (lista) => lista[Math.floor(Math.random() * lista.length)];

// Un comentario nuevo en una publicación de la cuenta conectada: si trae la palabra de un flujo "Comentario en Instagram",
// el cliente recibe una respuesta privada (DM) con el flujo y, si llegó, un comentario público debajo del suyo.
async function handleInstagramComment(valor, entryId) {
    try {
        const comentarioId = valor?.id;
        const texto = valor?.text;
        const autorId = valor?.from?.id;
        if (!comentarioId || !texto || !autorId || !entryId) return;
        if (autorId === entryId) return;                       // comentario de la propia cuenta (p. ej. nuestra respuesta)
        if (comentariosAtendidos.has(comentarioId)) return;

        const [negocios] = await db.execute('SELECT id FROM negocios WHERE instagram_user_id = ?', [entryId]);
        if (negocios.length === 0) return;
        const negocioId = negocios[0].id;

        const flujos = require('../services/flujosEjecucion');
        const coincidencia = await flujos.buscarFlujoPorComentario(negocioId, texto);
        if (!coincidencia) return;
        comentariosAtendidos.set(comentarioId, true);
        if (comentariosAtendidos.size > MAX_COMENTARIOS_RECORDADOS) comentariosAtendidos.delete(comentariosAtendidos.keys().next().value);

        // Mismo tope diario que los demás mensajes que el negocio manda sin que el cliente escriba primero.
        if ((await flujos.enviadosHoy(negocioId)) >= flujos.MAX_PROACTIVOS_DIA) {
            console.warn(`[Instagram] Tope diario de mensajes automáticos alcanzado (negocio ${negocioId}): comentario ${comentarioId} sin responder`);
            return;
        }

        const identificador = `${PREFIJO_CLIENTE}${autorId}`;
        const nombre = String(valor.from.username || 'Instagram User').slice(0, 100);
        const [clientes] = await db.execute('SELECT id, nombre FROM clientes WHERE negocio_id = ? AND whatsapp = ?', [negocioId, identificador]);
        let clienteId;
        if (clientes.length === 0) {
            const [nuevo] = await db.execute('INSERT INTO clientes (negocio_id, nombre, whatsapp) VALUES (?, ?, ?)', [negocioId, nombre, identificador]);
            clienteId = nuevo.insertId;
        } else {
            clienteId = clientes[0].id;
        }

        // Una respuesta privada admite un solo mensaje: lo que el flujo diga de entrada se junta en uno.
        const partes = [];
        const resultado = await flujos.iniciarParaCliente(coincidencia.flujo, {
            negocioId, cliente: { id: clienteId, nombre: clientes[0]?.nombre || nombre, total_gastado: 0, total_pedidos: 0 },
            enviar: async (t) => { partes.push(t); },
        });
        if (resultado && resultado.sinRespuesta) return;
        const mensaje = partes.join('\n\n').trim();
        if (!mensaje) return;

        const privada = await enviarRespuestaPrivada(db, negocioId, comentarioId, mensaje);
        if (!privada.ok) {
            console.error(`[Instagram] No se pudo enviar la respuesta privada (negocio ${negocioId}): ${privada.motivo} ${privada.detalle || ''}`);
            return;   // sin DM no se anuncia "te escribimos por privado"
        }

        const [convs] = await db.execute('SELECT id FROM conversaciones WHERE negocio_id = ? AND cliente_id = ? AND activa = 1 ORDER BY id DESC LIMIT 1', [negocioId, clienteId]);
        if (convs.length === 0) await db.execute('INSERT INTO conversaciones (negocio_id, cliente_id, activa) VALUES (?, ?, 1)', [negocioId, clienteId]);
        await db.execute(
            'INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido) VALUES (?, ?, ?, ?)',
            [negocioId, identificador, 'entrada', texto]
        );
        await db.execute(
            'INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada) VALUES (?, ?, ?, ?, ?, ?)',
            [negocioId, identificador, 'salida', mensaje, 'flujo_proactivo', 'comentario']   // cuenta para el tope diario
        );

        const publica = variante(coincidencia.respuestas.length ? coincidencia.respuestas : ['¡Te escribimos por privado! 📩']);
        const pub = await responderComentario(db, negocioId, comentarioId, publica);
        if (!pub.ok) console.error(`[Instagram] No se pudo responder el comentario en público (negocio ${negocioId}): ${pub.motivo} ${pub.detalle || ''}`);
    } catch (error) {
        console.error('[Instagram] Error handling comment:', error);
    }
}

// Se expone para las pruebas (sin levantar el servidor).
router.handleInstagramMessage = handleInstagramMessage;
router.handleInstagramComment = handleInstagramComment;

module.exports = router;
