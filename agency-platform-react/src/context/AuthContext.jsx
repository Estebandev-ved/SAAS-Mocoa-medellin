import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('antigravity_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('antigravity_user');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, [token]);

  const guardarSesion = (response) => {
    setToken(response.token);
    setUser(response.negocio);
    localStorage.setItem('antigravity_token', response.token);
    localStorage.setItem('antigravity_user', JSON.stringify(response.negocio));
  };

  const mensajeError = (error) =>
    error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Error de conexión con el servidor';

  // Si la cuenta tiene verificación en dos pasos, devuelve { requiere2fa, token2fa } y la
  // pantalla debe pedir el código y llamar a login2fa.
  const login = async (email, password) => {
    try {
      const response = await authService.login(email, password);
      if (response.requiere_2fa) {
        return { success: false, requiere2fa: true, token2fa: response.token_2fa };
      }
      if (response.token) {
        guardarSesion(response);
        return { success: true, negocio: response.negocio };
      }
      return { success: false, error: response.error };
    } catch (error) {
      return { success: false, error: mensajeError(error) };
    }
  };

  const login2fa = async (token2fa, codigo) => {
    try {
      const response = await authService.login2fa(token2fa, codigo);
      if (response.token) {
        guardarSesion(response);
        return { success: true, negocio: response.negocio };
      }
      return { success: false, error: response.error };
    } catch (error) {
      return { success: false, error: mensajeError(error), expirado: error.response?.data?.codigo === 'TOKEN_2FA_EXPIRADO' };
    }
  };

  const register = async (name, email, password, phone, avatar, terminos) => {
    try {
      const response = await authService.register(name, email, password, phone, avatar, terminos);
      if (response.token) {
        setToken(response.token);
        setUser(response.negocio);
        localStorage.setItem('antigravity_token', response.token);
        localStorage.setItem('antigravity_user', JSON.stringify(response.negocio));
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Error de conexión con el servidor' 
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('antigravity_token');
    localStorage.removeItem('antigravity_user');
  };

  const updateUser = (updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('antigravity_user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, login2fa, logout, register, updateUser, loading, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
