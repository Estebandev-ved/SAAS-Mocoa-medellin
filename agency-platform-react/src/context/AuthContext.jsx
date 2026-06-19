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

  const login = async (email, password) => {
    try {
      const response = await authService.login(email, password);
      if (response.success) {
        setToken(response.token);
        setUser(response.user);
        localStorage.setItem('antigravity_token', response.token);
        localStorage.setItem('antigravity_user', JSON.stringify(response.user));
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Error de conexión con el servidor' 
      };
    }
  };

  const register = async (name, email, password, phone) => {
    try {
      const response = await authService.register(name, email, password, phone);
      if (response.success) {
        setToken(response.token);
        setUser(response.user);
        localStorage.setItem('antigravity_token', response.token);
        localStorage.setItem('antigravity_user', JSON.stringify(response.user));
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Error de conexión con el servidor' 
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('antigravity_token');
    localStorage.removeItem('antigravity_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, register, loading, isAuthenticated: !!token }}>
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
