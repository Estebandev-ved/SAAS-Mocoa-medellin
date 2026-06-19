import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Use interceptor for dynamic token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('antigravity_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export const authService = {
    login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    },
    register: async (name, email, password, phone) => {
        const response = await api.post('/auth/register', { name, email, password, phone });
        return response.data;
    }
};

export const ordersService = {
    getAll: async () => {
        const response = await api.get('/pedidos');
        return response.data;
    },
    getById: async (id) => {
        const response = await api.get(`/pedidos/${id}`);
        return response.data;
    },
    create: async (orderData) => {
        const response = await api.post('/pedidos', orderData);
        return response.data;
    }
};

export const productsService = {
    getAll: async () => {
        const response = await api.get('/productos');
        return response.data;
    }
};

export const analyticsService = {
    getDaily: async (negocioId) => {
        const response = await api.get(`/analytics/diario/${negocioId}`);
        return response.data;
    }
};

export { api };
export default api;
