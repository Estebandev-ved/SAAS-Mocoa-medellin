import axios from 'axios';

import { API_ORIGIN } from '../config';
const API_URL = API_ORIGIN;

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('antigravity_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/delivery')) {
      localStorage.removeItem('antigravity_token');
      localStorage.removeItem('antigravity_user');
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
  },
  sendMessage: async (conversacionId, mensaje) => {
    const response = await api.post(`/api/chat/conversaciones/${conversacionId}/mensaje`, { mensaje });
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
    // Antes esto no llamaba al backend (siempre devolvía { success: true }
    // sin hacer nada) — todo lo que el usuario llena en el registro
    // (tipo de negocio, dirección, métodos de pago, Nequi/Bancolombia...)
    // se perdía apenas terminaba el wizard. El endpoint ya existía y
    // funcionaba bien, solo nadie lo estaba llamando.
    const response = await api.put(`/api/business/onboarding/${step}`, data);
    return response.data;
  },
  aplicarPlantilla: async (tipoNegocio) => {
    const response = await api.post('/api/business/plantilla', { tipo_negocio: tipoNegocio });
    return response.data;
  },
  upgradePlan: async (nuevoPlan) => {
    const response = await api.post('/api/business/plan/upgrade', { nuevoPlan });
    return response.data;
  },
  updatePassword: async (passwordActual, passwordNuevo) => {
    const response = await api.put('/api/business/password', { passwordActual, passwordNuevo });
    return response.data;
  }
};

export const botConfigService = {
  getConfig: async () => {
    const response = await api.get('/api/bot/config');
    return response.data;
  },
  updateConfig: async (datos) => {
    const response = await api.put('/api/bot/config', datos);
    return response.data;
  }
};

export const usuariosService = {
  getAll: async () => {
    const response = await api.get('/api/usuarios');
    return response.data;
  },
  create: async (datos) => {
    const response = await api.post('/api/usuarios', datos);
    return response.data;
  },
  update: async (id, datos) => {
    const response = await api.put(`/api/usuarios/${id}`, datos);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/api/usuarios/${id}`);
    return response.data;
  }
};

export const domiciliosService = {
  getDrivers: async () => {
    const response = await api.get('/api/domicilios/drivers');
    return response.data;
  },
  createDriver: async (data) => {
    const response = await api.post('/api/domicilios/drivers', data);
    return response.data;
  },
  deleteDriver: async (id) => {
    const response = await api.delete(`/api/domicilios/drivers/${id}`);
    return response.data;
  },
  getActive: async () => {
    const response = await api.get('/api/domicilios/active');
    return response.data;
  },
  assign: async (domicilioId, domiciliarioId) => {
    const response = await api.post('/api/domicilios/assign', { domicilio_id: domicilioId, domiciliario_id: domiciliarioId });
    return response.data;
  },
  checkModule: async () => {
    const response = await api.get('/api/domicilios/modulos/check');
    return response.data;
  }
};

export default api;
export { apiService };
