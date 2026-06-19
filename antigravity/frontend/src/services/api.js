import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ag_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ag_token');
      localStorage.removeItem('ag_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const apiService = {
  get: async (url) => {
    const response = await api.get(url);
    return response.data;
  },
  post: async (url, data) => {
    const response = await api.post(url, data);
    return response.data;
  },
  put: async (url, data) => {
    const response = await api.put(url, data);
    return response.data;
  },
  delete: async (url) => {
    const response = await api.delete(url);
    return response.data;
  }
};

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },
  register: async (datos) => {
    const response = await api.post('/api/auth/registro', datos);
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/api/auth/logout');
    return response.data;
  },
  verify: async () => {
    const response = await api.get('/api/auth/verify');
    return response.data;
  }
};

export const ordersService = {
  getAll: async (filtros = {}) => {
    const response = await api.get('/api/pedidos', { params: filtros });
    return response.data;
  },
  updateEstado: async (id, estado) => {
    const response = await api.put(`/api/pedidos/${id}`, { estado });
    return response.data;
  }
};

export const productsService = {
  getAll: async () => {
    const response = await api.get('/api/productos');
    return response.data;
  },
  create: async (datos) => {
    const response = await api.post('/api/productos', datos);
    return response.data;
  },
  update: async (id, datos) => {
    const response = await api.put(`/api/productos/${id}`, datos);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/api/productos/${id}`);
    return response.data;
  }
};

export const analyticsService = {
  getResumen: async () => {
    const response = await api.get('/api/analytics/resumen');
    return response.data;
  },
  getVentas: async () => {
    const response = await api.get('/api/analytics/ventas');
    return response.data;
  }
};

export const conversationsService = {
  getAll: async () => {
    const response = await api.get('/api/chat/conversaciones');
    return response.data;
  }
};

export const businessService = {
  getPerfil: async () => {
    const response = await api.get('/api/business/perfil');
    return response.data;
  },
  updatePerfil: async (datos) => {
    const response = await api.put('/api/business/perfil', datos);
    return response.data;
  },
  getPlan: async () => {
    const response = await api.get('/api/business/plan');
    return response.data;
  },
  saveOnboardingStep: async (step, data) => {
    return { success: true };
  },
  upgradePlan: async (nuevoPlan) => {
    const response = await api.post('/api/business/plan/upgrade', { nuevoPlan });
    return response.data;
  }
};

export default api;
export { apiService };
