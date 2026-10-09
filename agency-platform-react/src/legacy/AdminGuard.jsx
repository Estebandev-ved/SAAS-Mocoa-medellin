import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from './services/api';

const ES_ADMIN = (rol) => rol === 'admin' || rol === 'superadmin';

// Solo cuentas admin/superadmin. El rol se consulta al servidor (no solo al navegador), así un
// rol recién asignado (ADMIN_EMAIL) funciona sin volver a iniciar sesión. El backend vuelve a
// validar el rol en cada llamada.
export default function AdminGuard({ children }) {
  const { user, loading, isAuthenticated, updateUser, logout } = useAuth();
  const [estado, setEstado] = useState('verificando'); // verificando | admin | no_admin | error
  const [detalle, setDetalle] = useState('');

  useEffect(() => {
    if (loading || !isAuthenticated) return undefined;
    let activo = true;
    authService.verify()
      .then((r) => {
        if (!activo) return;
        const rol = r?.negocio?.rol;
        if (ES_ADMIN(rol)) {
          if (!ES_ADMIN(user?.rol)) updateUser({ rol });
          setEstado('admin');
        } else {
          setDetalle(`Tu cuenta (${r?.negocio?.email || 'sin correo'}) tiene rol "${rol || 'negocio'}".`);
          setEstado('no_admin');
        }
      })
      .catch((e) => {
        if (!activo) return;
        if (e.response?.status === 401) { setEstado('sesion'); return; }
        setDetalle(e.response?.data?.error || e.message || 'No se pudo conectar con el servidor.');
        setEstado('error');
      });
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthenticated]);

  if (loading) return null;
  if (!isAuthenticated || estado === 'sesion') return <Navigate to="/login" replace />;
  if (estado === 'verificando') {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Verificando acceso…</div>;
  }
  if (estado === 'admin') return children;

  const sinRol = estado === 'no_admin';
  return (
    <div style={{ maxWidth: 520, margin: '12vh auto', padding: 24, textAlign: 'center' }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>{sinRol ? 'Esta cuenta no es administradora' : 'No pudimos verificar tu acceso'}</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 8 }}>{detalle}</p>
      {sinRol && (
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 20 }}>
          En Railway, en las variables del servicio de la API, revisa que <code>ADMIN_EMAIL</code> sea exactamente
          el correo de esta cuenta, y que el último despliegue haya terminado. Luego recarga esta página.
        </p>
      )}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/dashboard" style={{ padding: '10px 18px', border: '1px solid var(--color-border)', borderRadius: 10 }}>Ir a mi Dashboard</Link>
        <button onClick={() => { logout(); window.location.href = '/login'; }} style={{ padding: '10px 18px', borderRadius: 10, border: 0, background: 'var(--color-primary)', color: '#fff' }}>Cerrar sesión</button>
      </div>
    </div>
  );
}
