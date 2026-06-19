import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';

let socket = null;

export const initSocket = (token) => {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const subscribeToNegocio = (negocioId) => {
  if (socket?.connected) {
    socket.emit('suscribirse_negocio', negocioId);
  }
};

export const onNuevoPedido = (callback) => {
  if (socket) {
    socket.on('nuevo_pedido', (data) => {
      console.log('[Socket] Nuevo pedido:', data);
      callback(data);
    });
  }
};

export const onEstadoPedido = (callback) => {
  if (socket) {
    socket.on('estado_pedido', callback);
  }
};

export const onNuevoMensaje = (callback) => {
  if (socket) {
    socket.on('nuevo_mensaje', callback);
  }
};

export const onBotStatus = (callback) => {
  if (socket) {
    socket.on('bot_status', callback);
  }
};

export const onBotQR = (callback) => {
  if (socket) {
    socket.on('bot_qr', (data) => {
      console.log('[Socket] QR recibido:', data);
      callback(data);
    });
  }
};

export const onBotConnected = (callback) => {
  if (socket) {
    socket.on('bot_connected', (data) => {
      console.log('[Socket] Bot conectado:', data);
      callback(data);
    });
  }
};

export const onBotDisconnected = (callback) => {
  if (socket) {
    socket.on('bot_disconnected', (data) => {
      console.log('[Socket] Bot desconectado:', data);
      callback(data);
    });
  }
};

export const onCampañaProgreso = (callback) => {
  if (socket) {
    socket.on('campaña_progreso', (data) => {
      console.log('[Socket] Progreso campaña:', data);
      callback(data);
    });
  }
};

export const removeAllListeners = () => {
  if (socket) {
    socket.removeAllListeners();
  }
};

export default socket;
