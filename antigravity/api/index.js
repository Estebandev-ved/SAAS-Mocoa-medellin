const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { 
    helmetConfig, 
    apiRateLimit, 
    sanitizeInputs, 
    secureErrorHandler,
    sanitizeLog 
} = require('./middleware/security');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { 
        origin: process.env.NODE_ENV === 'production' 
            ? ['https://antigravity.co', 'https://app.antigravity.co'] 
            : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:*'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Seguridad completa de cabeceras HTTP
app.use(helmetConfig);

// Sanitización de inputs contra XSS
app.use(sanitizeInputs);

// Rate Limiter Global (100 peticiones por minuto por IP)
app.use('/api', apiRateLimit);

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://antigravity.co', 'https://app.antigravity.co'] 
        : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:*'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
});

const allRoutes = require('./routes/all');
const authRoutes = require('./routes/auth');
const automationsRoutes = require('./routes/automations');
const businessRoutes = require('./routes/business');
const whatsappRoutes = require('./routes/whatsapp');
const botConfigRoutes = require('./routes/bot-config');
const conversacionesRoutes = require('./routes/conversaciones');
const adminRoutes = require('./routes/admin');
const agentesRoutes = require('./routes/agentes');
const domiciliosRoutes = require('./routes/domicilios');

app.use('/api', allRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', automationsRoutes);
app.use('/api/negocio', businessRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/bot', botConfigRoutes);
app.use('/api/conversaciones', conversacionesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agentes', agentesRoutes);
app.use('/api/domicilios', domiciliosRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.json({ name: 'ANTIGRAVITY API', version: '1.0.0', status: 'running' });
});

app.use(secureErrorHandler);

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

const PORT = process.env.PORT_API || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'antigravity_secret_key';
const SOCKET_SECRET = process.env.SOCKET_SECRET || 'secreto_interno_antigravity';

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
        
        return;
    }
    
    socket.on('suscribirse_negocio', (negocioId) => {
        socket.join(`negocio_${negocioId}`);
    });
    
    socket.on('suscribirse_whatsapp', (negocioId) => {
        socket.join(`negocio_${negocioId}`);
        console.log(`[Socket] Suscripción WhatsApp: negocio_${negocioId}`);
    });
    
    socket.on('disconnect', () => {
        console.log(`[Socket] Cliente desconectado: ${socket.id}`);
    });
});

const BRAIN_URL = process.env.BRAIN_URL || 'http://localhost:8000';

setInterval(async () => {
    try {
        const axios = require('axios');
        const res = await axios.get(`${BRAIN_URL}/agentes/stats`, { timeout: 5000 });
        io.emit('agentes_stats', res.data);
    } catch (err) {
        // console.log('[Socket] Brain no disponible para stats de agentes');
    }
}, 15000);

server.listen(PORT, () => {
    console.log(`[API] Servidor corriendo en puerto ${PORT}`);
});

module.exports = { app, server, io };
