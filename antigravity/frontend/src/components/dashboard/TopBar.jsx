import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PlanBadge from './PlanBadge';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import './TopBar.css';

const routeTitles = {
  '/dashboard': 'Resumen',
  '/dashboard/resumen': 'Resumen',
  '/dashboard/pedidos': 'Pedidos',
  '/dashboard/conversaciones': 'Conversaciones',
  '/dashboard/productos': 'Productos',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/automatizaciones': 'Automatizaciones',
  '/dashboard/personalizar': 'Personalizar',
  '/dashboard/ajustes': 'Ajustes'
};

export default function TopBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const title = routeTitles[location.pathname] || 'Dashboard';

  const getTrialDaysLeft = () => {
    if (!user?.trial_hasta) return null;
    const trialEnd = new Date(user.trial_hasta);
    const now = new Date();
    const diff = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const trialDays = getTrialDaysLeft();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-center">
        <div className="search-bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar pedidos, clientes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="search-shortcut">Ctrl+K</span>
        </div>
      </div>

      <div className="topbar-right">
        {trialDays !== null && trialDays > 0 && (
          <div className="trial-banner">
            ⚡ {trialDays} días de prueba restantes
          </div>
        )}

        <button className="notification-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="notification-badge">3</span>
        </button>

        <div className="user-menu-wrapper">
          <button className="user-avatar" onClick={() => setShowUserMenu(!showUserMenu)}>
            {user?.nombre?.charAt(0) || 'U'}
          </button>

          {showUserMenu && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <span className="user-dropdown-name">{user?.nombre}</span>
                <span className="user-dropdown-email">{user?.email}</span>
                <PlanBadge plan={user?.plan} size="sm" />
              </div>
              <div className="user-dropdown-items">
                <button onClick={() => { navigate('/dashboard/ajustes'); setShowUserMenu(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Ver perfil
                </button>
                <button onClick={() => { navigate('/dashboard/ajustes'); setShowUserMenu(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Cambiar plan
                </button>
                <div className="user-dropdown-divider"></div>
                <button className="logout" onClick={handleLogout}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
