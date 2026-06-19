const { Server } = require('socket.io');
const http = require('http');

let io = null;
let servidorHttp = null;

function inicializarSocket(puerto) {
    servidorHttp = http.createServer();
    io = new Server(servidorHttp, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    io.on('connection', (socket) => {
        console.log(`[Socket.io] Cliente conectado: ${socket.id}`);

        socket.on('suscribirse_negocio', (negocioId) => {
            socket.join(`negocio_${negocioId}`);
            console.log(`[Socket.io] Cliente ${socket.id} suscrito al negocio ${negocioId}`);
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Socket.io] Cliente desconectado: ${socket.id}, razón: ${reason}`);
        });

        socket.on('error', (error) => {
            console.error(`[Socket.io] Error en socket ${socket.id}:`, error.message);
        });
    });

    servidorHttp.listen(puerto, () => {
        console.log(`[Socket.io] Servidor corriendo en puerto ${puerto}`);
    });

    return io;
}

function obtenerIO() {
    return io;
}

function emitirNuevoPedido(pedido, negocioId) {
    if (!io) {
        console.error('[Socket.io] IO no inicializado');
        return;
    }

    io.to(`negocio_${negocioId}`).emit('nuevo_pedido', pedido);
    console.log(`[Socket.io] Emitido nuevo_pedido para negocio ${negocioId}:`, pedido.numero_pedido);
}

function emitirEstadoCambiado(pedidoId, nuevoEstado, negocioId, datosCompletos = null) {
    if (!io) {
        console.error('[Socket.io] IO no inicializado');
        return;
    }

    const payload = {
        pedido_id: pedidoId,
        nuevo_estado: nuevoEstado,
        datos: datosCompletos,
        timestamp: new Date().toISOString()
    };

    io.to(`negocio_${negocioId}`).emit('estado_pedido', payload);
    console.log(`[Socket.io] Emitido estado_pedido: ${pedidoId} -> ${nuevoEstado}`);
}

function emitirNuevoMensaje(conversacion, negocioId) {
    if (!io) {
        console.error('[Socket.io] IO no inicializado');
        return;
    }

    io.to(`negocio_${negocioId}`).emit('nuevo_mensaje', conversacion);
    console.log(`[Socket.io] Emitido nuevo_mensaje para negocio ${negocioId}`);
}

function emitirNuevaConversacion(conversacion, negocioId) {
    if (!io) {
        console.error('[Socket.io] IO no inicializado');
        return;
    }

    io.to(`negocio_${negocioId}`).emit('nueva_conversacion', conversacion);
    console.log(`[Socket.io] Emitida nueva_conversacion para negocio ${negocioId}`);
}

function emitirAnalyticsActualizado(negocioId, datos) {
    if (!io) {
        console.error('[Socket.io] IO no inicializado');
        return;
    }

    io.to(`negocio_${negocioId}`).emit('analytics_actualizado', datos);
    console.log(`[Socket.io] Emitido analytics_actualizado para negocio ${negocioId}`);
}

function emitirNotificacion(negocioId, tipo, datos) {
    if (!io) {
        console.error('[Socket.io] IO no inicializado');
        return;
    }

    io.to(`negocio_${negocioId}`).emit('notificacion', {
        tipo,
        datos,
        timestamp: new Date().toISOString()
    });
    console.log(`[Socket.io] Emitida notificación ${tipo} para negocio ${negocioId}`);
}

function setIO(instance) {
    io = instance;
    console.log('[Socket.io] Instancia de IO establecida desde el exterior');
}

module.exports = {
    setIO,
    inicializarSocket,
    obtenerIO,
    emitirNuevoPedido,
    emitirEstadoCambiado,
    emitirNuevoMensaje,
    emitirNuevaConversacion,
    emitirAnalyticsActualizado,
    emitirNotificacion
};
