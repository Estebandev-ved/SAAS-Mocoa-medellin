// Origen del backend SIN el sufijo /api (el código del panel y del portal ya escribe '/api/...').
// En producción sale de VITE_SOCKET_URL (mismo host de la API).
export const API_ORIGIN = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';
export const SOCKET_URL = API_ORIGIN;
