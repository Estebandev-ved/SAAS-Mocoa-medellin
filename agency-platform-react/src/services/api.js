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

export const interesadosService = {
    enviar: async (datos) => {
        const response = await api.post('/public/interesados', datos);
        return response.data;
    }
};

export const authService = {
    login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    },
    register: async (name, email, password, phone, avatar, terminos) => {
        const response = await api.post('/auth/registro', {
            nombre: name, email_dueno: email, password, whatsapp: phone, avatar, terminos_aceptados: !!terminos
        });
        return response.data;
    }
};

// Onboarding progresivo: se piden solo los datos mínimos al registrarse y el resto se completa en el panel.
export const businessService = {
    saveOnboardingStep: async (paso, datos) => {
        const response = await api.put(`/business/onboarding/${paso}`, datos);
        return response.data;
    },
    // Logros y consejos de los personajes ya vistos (se guardan en el servidor para no repetirse entre dispositivos)
    getUiEstado: async () => {
        const response = await api.get('/business/ui-estado');
        return response.data;
    },
    saveUiEstado: async (vistos) => {
        const response = await api.put('/business/ui-estado', { vistos });
        return response.data;
    },
    aplicarPlantilla: async (tipoNegocio) => {
        const response = await api.post('/business/plantilla', { tipo_negocio: tipoNegocio });
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
    getDaily: async () => {
        const response = await api.get('/analytics/resumen');
        return response.data;
    }
};

export const whitelistService = {
    get: async () => {
        const response = await api.get('/bot/whitelist');
        return response.data;
    },
    update: async (modo, numeros) => {
        const response = await api.put('/bot/whitelist', { modo, numeros });
        return response.data;
    }
};

export { api };
export default api;
