import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('ag_token'));
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (token) {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, []);

  const checkAuth = async () => {
    try {
      const response = await authService.verify();
      const userData = response.negocio;
      setUser(userData);
      localStorage.setItem('ag_user', JSON.stringify(userData));
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('ag_token');
      localStorage.removeItem('ag_user');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await authService.login(email, password);
    const userData = response.negocio;
    localStorage.setItem('ag_token', response.token);
    localStorage.setItem('ag_user', JSON.stringify(userData));
    setToken(response.token);
    setUser(userData);
    setIsAuthenticated(true);
    return response;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('ag_token');
      localStorage.removeItem('ag_user');
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const register = async (datos) => {
    const response = await authService.register(datos);
    localStorage.setItem('ag_token', response.token);
    localStorage.setItem('ag_user', JSON.stringify(response.negocio));
    setToken(response.token);
    setUser(response.negocio);
    setIsAuthenticated(true);
    return response;
  };

  const updateUser = (nuevosDatos) => {
    const updatedUser = { ...user, ...nuevosDatos };
    setUser(updatedUser);
    localStorage.setItem('ag_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isAuthenticated,
      login,
      logout,
      register,
      updateUser,
      checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
