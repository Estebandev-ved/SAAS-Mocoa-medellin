import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';

const socket = io(SOCKET_URL, {
    autoConnect: true,
    reconnection: true
});

export const subscribeToBusiness = (businessId) => {
    if (!socket.connected) {
        socket.connect();
    }
    socket.emit('suscribirse_negocio', businessId);
};

export default socket;
