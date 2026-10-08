const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Fail-fast: sin estos secretos definidos, el server no debe arrancar.
// El fallback anterior ('antigravity_secret_key' / 'secreto_interno_antigravity')
// quedaba escrito en el código fuente — cualquiera con acceso al repo podía
// forjar tokens válidos si la variable de entorno real no estaba configurada.
if (!process.env.JWT_SECRET || !process.env.SOCKET_SECRET) {
    console.error('[FATAL] Faltan JWT_SECRET y/o SOCKET_SECRET en las variables de entorno. El servidor no arranca sin ellos por seguridad.');
    process.exit(1);
}

const {
    helmetConfig, 
    apiRateLimit, 
    sanitizeInputs, 
    secureErrorHandler,
    sanitizeLog,
    auditLogger,
    compressionMiddleware,
    corsConfig,
    isAllowedOrigin
} = require('./middleware/security');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Seguridad completa de cabeceras HTTP
app.use(helmetConfig);

// Compresión gzip para todas las respuestas
app.use(compressionMiddleware);

// Sanitización de inputs contra XSS
app.use(sanitizeInputs);

// Rate Limiter Global (100 peticiones por minuto por IP)
app.use('/api', apiRateLimit);

// Logger de auditoría
app.use(auditLogger);

// Stripe webhook - DEBE ir ANTES de express.json para recibir body raw
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('[Stripe] Webhook signature failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const { negocio_id, plan } = session.metadata;
            const now = new Date();
            const fin = new Date(now);
            fin.setMonth(fin.getMonth() + 1);

            await db.execute(
                `UPDATE negocios SET plan = ?, suscripcion_activa = 1, suscripcion_inicio = ?, suscripcion_fin = ?, stripe_customer_id = ? WHERE id = ?`,
                [plan, now, fin, session.customer, negocio_id]
            );

            await db.execute(
                `UPDATE suscripciones SET estado = 'activa', plan = ?, pago_inicio = ?, pago_fin = ?, stripe_sub_id = ? WHERE negocio_id = ? AND estado IN ('trial','vencida') ORDER BY id DESC LIMIT 1`,
                [plan, now, fin, session.subscription, negocio_id]
            );

            const { getPlanPrice } = require('../config/planConfig');
            const invoiceNum = `INV-${Date.now()}-${negocio_id}`;
            await db.execute(
                `INSERT INTO invoices (negocio_id, numero, plan, monto, estado, metodo_pago, stripe_invoice_id, fecha_pago, fecha_vencimiento, descripcion) VALUES (?, ?, ?, ?, 'pagada', 'stripe', ?, NOW(), ?, ?)`,
                [negocio_id, invoiceNum, plan, getPlanPrice(plan), session.payment_intent, fin, `Pago inicial plan ${plan}`]
            );

            await db.execute(
                `INSERT INTO billing_history (negocio_id, tipo, plan_nuevo, monto, descripcion) VALUES (?, 'payment_success', ?, ?, ?)`,
                [negocio_id, plan, getPlanPrice(plan), `Pago exitoso plan ${plan}`]
            );

            console.log(`[Stripe] Pago exitoso: negocio ${negocio_id}, plan ${plan}`);
        }

        if (event.type === 'invoice.payment_failed') {
            const invoice = event.data.object;
            const customer = await stripe.customers.retrieve(invoice.customer);
            const negocioId = customer.metadata.negocio_id;
            if (negocioId) {
                await db.execute(`UPDATE negocios SET suscripcion_activa = 0 WHERE id = ?`, [negocioId]);
                await db.execute(
                    `INSERT INTO billing_history (negocio_id, tipo, monto, descripcion) VALUES (?, 'payment_failed', ?, ?)`,
                    [negocioId, invoice.amount_due, `Pago fallido - ${invoice.failure_reason}`]
                );
                console.log(`[Stripe] Pago fallido: negocio ${negocioId}`);
            }
        }

        if (event.type === 'invoice.paid') {
            const invoice = event.data.object;
            if (invoice.subscription) {
                const customer = await stripe.customers.retrieve(invoice.customer);
                const negocioId = customer.metadata.negocio_id;
                if (negocioId) {
                    const now = new Date();
                    const fin = new Date(now);
                    fin.setMonth(fin.getMonth() + 1);
                    await db.execute(`UPDATE negocios SET suscripcion_fin = ?, suscripcion_activa = 1 WHERE id = ?`, [fin, negocioId]);
                    await db.execute(`UPDATE suscripciones SET pago_fin = ?, estado = 'activa' WHERE stripe_sub_id = ?`, [fin, invoice.subscription]);
                    console.log(`[Stripe] Renovación exitosa: negocio ${negocioId}`);
                }
            }
        }

        if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object;
            await db.execute(`UPDATE negocios SET suscripcion_activa = 0 WHERE stripe_customer_id = ?`, [subscription.customer]);
            await db.execute(`UPDATE suscripciones SET estado = 'cancelada' WHERE stripe_sub_id = ?`, [subscription.id]);
            console.log(`[Stripe] Suscripción cancelada: ${subscription.id}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('[Stripe] Error procesando webhook:', error.message);
        res.status(500).json({ error: 'Error procesando webhook' });
    }
});

app.use(cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// OCR Test Endpoint - PUBLIC for testing (before auth routes)
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/ocr/test', upload.single('imagen'), async (req, res) => {
    // Este endpoint no pide autenticación y corre OCR (costo por llamada) sobre
    // cualquier negocio_id que se le mande en el body. Desactivado en producción
    // hasta que tenga auth propia; sigue disponible en desarrollo para pruebas.
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    try {
        const { verificarPagoConImagen } = require('../instance-manager/agents/gemini');

        if (!req.file) {
            return res.status(400).json({ error: 'No se envió ninguna imagen' });
        }

        const imagenBase64 = req.file.buffer.toString('base64');
        const totalEsperado = parseFloat(req.body.total) || 0;
        const negocioId = parseInt(req.body.negocio_id) || 8;

        console.log(`[OCR Test] Probando OCR para negocio ${negocioId}, total esperado: $${totalEsperado}`);

        const resultado = await verificarPagoConImagen(imagenBase64, negocioId, totalEsperado);

        let rawResponse = null;
        const apiKey = process.env.GEMINI_API_KEY;
        
        if (apiKey) {
            try {
                const body = {
                    contents: [{
                        parts: [
                            { text: `Analiza esta imagen de comprobante de pago colombiano. Extrae TODO: monto, banco, cuenta, nombre, fecha, hora, estado, referencia. Responde en JSON con todos los campos que encuentres.` },
                            { inlineData: { mimeType: req.file.mimetype || 'image/jpeg', data: imagenBase64 } }
                        ]
                    }]
                };

                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 30000);

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
                    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal }
                );
                clearTimeout(timeout);

                if (response.ok) {
                    const data = await response.json();
                    rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                }
            } catch (e) {
                rawResponse = 'Error: ' + e.message;
            }
        }

        res.json({
            success: true,
            resultado,
            raw_response: rawResponse,
            imagen_info: {
                nombre: req.file.originalname,
                tamaño: req.file.size,
                tipo: req.file.mimetype
            }
        });

    } catch (error) {
        console.error('[OCR Test] Error:', error);
        res.status(500).json({ error: 'Error en prueba OCR', details: error.message });
    }
});

app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
});

const authRoutes = require('./routes/auth');
const automationsRoutes = require('./routes/automations');
const automationsToggleRoutes = require('./routes/automations-toggle');
const businessRoutes = require('./routes/business');
const whatsappRoutes = require('./routes/whatsapp');
const botConfigRoutes = require('./routes/bot-config');
const conversacionesRoutes = require('./routes/conversaciones');
const chatRoutes = require('./routes/chatConversaciones');
const adminRoutes = require('./routes/admin');
const agentesRoutes = require('./routes/agentes');
const domiciliosRoutes = require('./routes/domicilios');
const clientesRoutes = require('./routes/clientes');
const ordersRoutes = require('./routes/orders');
const productsRoutes = require('./routes/products');
const usuariosRoutes = require('./routes/usuarios');
const backupRoutes = require('./routes/backup');
const campanasRoutes = require('./routes/campanas');
const horariosRoutes = require('./routes/horarios');
const suscripcionRoutes = require('./routes/suscripcion');
const stripeRoutes = require('./routes/stripe');
const analyticsAdvancedRoutes = require('./routes/analyticsAdvanced');
const telegramRoutes = require('./routes/telegram');
const instagramRoutes = require('./routes/instagram');
const voiceRoutes = require('./routes/voice');

app.use('/api/auth', authRoutes);
app.use('/api/automations', automationsToggleRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/bot', botConfigRoutes);
app.use('/api/conversaciones', conversacionesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/pedidos', ordersRoutes);
app.use('/api/productos', productsRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agentes', agentesRoutes);
app.use('/api/domicilios', domiciliosRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/campanas', campanasRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/suscripcion', suscripcionRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/analytics', analyticsAdvancedRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/voice', voiceRoutes);
// automationsRoutes define sus propios prefijos internos (/automatizaciones,
// /campañas) y se monta en la raíz /api, pero su router aplica
// `router.use(verificarAuth)` SIN restringir la ruta — eso exigía login de
// negocio para CUALQUIER endpoint de /api/* registrado después de este,
// incluidos los públicos (login del domiciliario, tracking del cliente).
// Va al final para que los routers específicos (ya montados arriba) atiendan
// primero sus propias rutas, y este solo actúe como fallback para
// /automatizaciones y /campañas.
app.use('/api', automationsRoutes);

app.get('/health', async (req, res) => {
    try {
        const db = require('../db/config');
        await db.execute('SELECT 1');
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            env: process.env.NODE_ENV || 'development',
            version: '1.0.0'
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            message: 'Database connection failed',
            timestamp: new Date().toISOString()
        });
    }
});

const { getAuditLog } = require('./middleware/security');
const db = require('../db/config');

app.get('/api/metrics', async (req, res) => {
    try {
        const [msgHoy] = await db.execute(
            'SELECT COUNT(*) as total FROM mensajes WHERE DATE(created_at) = CURDATE()'
        );
        const [convActivas] = await db.execute(
            'SELECT COUNT(*) as total FROM conversaciones WHERE activa = 1'
        );
        const [negocios] = await db.execute(
            'SELECT COUNT(*) as total FROM negocios WHERE activo = 1'
        );
        const [clientesHoy] = await db.execute(
            'SELECT COUNT(*) as total FROM clientes WHERE DATE(created_at) = CURDATE()'
        );
        const [pedidosHoy] = await db.execute(
            'SELECT COUNT(*) as total FROM pedidos WHERE DATE(created_at) = CURDATE()'
        );

        res.json({
            mensajes_hoy: msgHoy[0].total,
            conversaciones_activas: convActivas[0].total,
            negocios_activos: negocios[0].total,
            clientes_nuevos_hoy: clientesHoy[0].total,
            pedidos_hoy: pedidosHoy[0].total,
            uptime: Math.round(process.uptime()),
            memoria_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            auditoria_reciente: getAuditLog(5)
        });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo métricas' });
    }
});

app.get('/', (req, res) => {
    res.json({ name: 'ANTIGRAVITY API', version: '1.0.0', status: 'running' });
});

app.use(secureErrorHandler);

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

const PORT = process.env.PORT_API || 3002;
const JWT_SECRET = process.env.JWT_SECRET;
const SOCKET_SECRET = process.env.SOCKET_SECRET;

io.use(async (socket, next) => {
    const { token, secret, tipo } = socket.handshake.auth;
    const trackingToken = socket.handshake.query?.trackingToken;
    
    if (tipo === 'bot_interno' && secret === SOCKET_SECRET) {
        socket.isBotInterno = true;
        console.log('[Socket] Conexión de bot interno autorizada');
        return next();
    }
    
    if (trackingToken) {
        try {
            const db = require('../db/config');
            const [domicilios] = await db.execute(
                'SELECT id FROM domicilios WHERE tracking_token = ?',
                [trackingToken]
            );
            if (domicilios.length > 0) {
                socket.trackingToken = trackingToken;
                socket.join(`tracking_${trackingToken}`);
                console.log(`[Socket] Cliente tracking conectado: tracking_${trackingToken}`);
                return next();
            }
        } catch (err) {
            console.log('[Socket] Error verificando tracking token:', err.message);
        }
        return next(new Error('Token de seguimiento inválido'));
    }
    
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.negocioId = decoded.negocio_id;
            socket.join(`negocio_${decoded.negocio_id}`);
            console.log(`[Socket] Cliente dashboard conectado: negocio_${decoded.negocio_id}`);
            return next();
        } catch (err) {
            console.log('[Socket] Token inválido:', err.message);
            return next(new Error('No autorizado'));
        }
    }
    
    return next(new Error('No autorizado'));
});

io.on('connection', (socket) => {
    console.log(`[Socket] Cliente conectado: ${socket.id}`);
    
    if (socket.isBotInterno) {
        socket.on('nuevo_pedido', (data) => {
            console.log('[Socket] Nuevo pedido del bot:', data.numero_pedido);
            const room = data.room || `negocio_${data.negocio_id || 1}`;
            io.to(room).emit('nuevo_pedido', data);
        });
        
        socket.on('qr_update', (data) => {
            const room = `negocio_${data.negocio_id}`;
            io.to(room).emit('qr_update', { qr_data: data.qr_data });
        });
        
        socket.on('whatsapp_status', (data) => {
            const room = `negocio_${data.negocio_id}`;
            io.to(room).emit('whatsapp_status', data);
        });
        
        socket.on('nuevo_mensaje', (data) => {
            const room = `negocio_${data.negocio_id}`;
            io.to(room).emit('nuevo_mensaje', data);
        });

        socket.on('domicilio_nuevo', (data) => {
            const room = `negocio_${data.negocio_id}`;
            io.to(room).emit('domicilio_nuevo', data);
        });

        return;
    }
    
    // IMPORTANTE: antes esto dejaba a CUALQUIER cliente conectado unirse a la
    // room de CUALQUIER negocio con solo emitir el evento con el ID que quisiera
    // (el negocioId real del token, seteado en io.use(), nunca se validaba aquí).
    // Un cliente de tracking público o el dashboard de un negocio podía recibir
    // en tiempo real pedidos, mensajes y estados de WhatsApp de otro negocio.
    socket.on('suscribirse_negocio', (negocioId) => {
        if (!socket.negocioId || String(socket.negocioId) !== String(negocioId)) {
            console.warn(`[Socket] Suscripción rechazada: socket ${socket.id} intentó unirse a negocio_${negocioId} sin autorización`);
            return;
        }
        socket.join(`negocio_${negocioId}`);
    });

    socket.on('suscribirse_whatsapp', (negocioId) => {
        if (!socket.negocioId || String(socket.negocioId) !== String(negocioId)) {
            console.warn(`[Socket] Suscripción WhatsApp rechazada: socket ${socket.id} intentó unirse a negocio_${negocioId} sin autorización`);
            return;
        }
        socket.join(`negocio_${negocioId}`);
        console.log(`[Socket] Suscripción WhatsApp: negocio_${negocioId}`);
    });
    
    socket.on('disconnect', () => {
        console.log(`[Socket] Cliente desconectado: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`[API] Servidor corriendo en puerto ${PORT}`);
});

// Ejecuta recordatorio_pago / stock_bajo / reporte_semanal para los negocios
// que los tengan activos (ver api/scheduler.js). Antes de esto, ninguna
// automatización del catálogo disparaba nada real en ningún lado.
const { iniciarScheduler } = require('./scheduler');
iniciarScheduler();

module.exports = { app, server, io };
