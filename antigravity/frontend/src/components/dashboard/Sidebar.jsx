import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PlanBadge from '../../components/dashboard/PlanBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import './Sidebar.css';

const navItems = [
  { path: '/dashboard', icon: 'home', label: 'Resumen', exact: true },
  { path: '/dashboard/whatsapp', icon: 'whatsapp', label: 'WhatsApp', highlight: true },
  { path: '/dashboard/pedidos', icon: 'box', label: 'Pedidos', modulo: 'catalogo' },
  { path: '/dashboard/conversaciones', icon: 'chat', label: 'Conversaciones', modulo: 'crm' },
  { path: '/dashboard/productos', icon: 'tag', label: 'Productos', modulo: 'catalogo' },
  { path: '/dashboard/analytics', icon: 'chart', label: 'Analytics', plans: ['professional', 'enterprise'], modulo: 'reportes' },
  { path: '/dashboard/automatizaciones', icon: 'zap', label: 'Automatizaciones', plans: ['professional', 'enterprise'], modulo: 'crm' },
  { path: '/dashboard/domicilios', icon: 'truck', label: 'Domicilios', modulo: 'domicilios', plans: ['professional', 'enterprise'] },
  { path: '/dashboard/personalizar', icon: 'palette', label: 'Configurar Bot' },
  { path: '/dashboard/ajustes', icon: 'gear', label: 'Ajustes' },
  { path: '/admin/resumen', icon: 'shield', label: 'Panel Admin', role: 'admin' }
];

const Icons = ({ name }) => {
  const icons = {
    home: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
    whatsapp: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
    box: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    chat: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    tag: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/></svg>,
    chart: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    zap: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    palette: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12.5" r="0.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/></svg>,
    gear: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    lock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    shield: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    logout: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    truck: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
  };
  return icons[name] || null;
};

export default function Sidebar({ expanded, onToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isLocked = (item) => {
    if (!item.plans) return false;
    return !item.plans.includes(user?.plan);
  };

  return (
    <>
      <aside className={`sidebar ${expanded ? 'expanded' : ''}`} onMouseEnter={() => expanded || onToggle()} onMouseLeave={() => expanded && onToggle()}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="var(--accent-primary)" />
              <path d="M24 12L32 20L24 28L16 20L24 12Z" fill="var(--bg-primary)" />
            </svg>
            {expanded && <span>ANTIGRAVITY</span>}
          </div>
        </div>

        {user && (
          <div className="sidebar-business">
            <div className="business-avatar" style={{ background: user.color_principal || 'var(--accent-primary)' }}>
              {user.nombre?.charAt(0) || 'N'}
            </div>
            {expanded && (
              <div className="business-info">
                <span className="business-name">{user.nombre}</span>
                <PlanBadge plan={user.plan} size="sm" />
              </div>
            )}
          </div>
        )}

        <nav className="sidebar-nav">
          {navItems
            .filter(item => !item.role || item.role === user?.rol)
            .filter(item => {
              if (!item.modulo) return true;
              if (user?.rol === 'admin' || user?.rol === 'superadmin') return true;
              const modulosActivos = user?.modulos_activos || [];
              if (user && !user.modulos_activos) return true; // Fallback para no ocultar por error si no cargan
              return modulosActivos.includes(item.modulo);
            })
            .map(item => (
            <div key={item.path} className={`nav-item-wrapper ${isLocked(item) ? 'locked' : ''}`}>
              <NavLink
                to={item.path}
                end={item.exact}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={(e) => {
                  if (isLocked(item)) {
                    e.preventDefault();
                    setShowUpgradeModal(true);
                  }
                }}
              >
                <span className="nav-icon">
                  <Icons name={item.icon} />
                </span>
                {expanded && <span className="nav-label">{item.label}</span>}
                {isLocked(item) && expanded && (
                  <span className="nav-lock">
                    <Icons name="lock" />
                  </span>
                )}
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="bot-status">
            <span className="status-dot active"></span>
            {expanded && <span>Bot activo</span>}
          </div>
          <button className="logout-btn" onClick={() => setShowLogoutModal(true)}>
            <Icons name="logout" />
            {expanded && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <Modal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} title="Cerrar sesión" size="sm">
        <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>
          ¿Estás seguro de que quieres cerrar sesión?
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="ghost" onClick={() => setShowLogoutModal(false)} fullWidth>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleLogout} fullWidth>
            Cerrar sesión
          </Button>
        </div>
      </Modal>

      <Modal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} title="Plan Requerido" size="sm">
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Esta función requiere el plan Professional o Enterprise.
          </p>
          <Button onClick={() => { setShowUpgradeModal(false); navigate('/dashboard/ajustes'); }} fullWidth>
            Ver planes
          </Button>
        </div>
      </Modal>
    </>
  );
}
