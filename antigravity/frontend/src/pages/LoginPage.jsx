import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import './AuthPages.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(email, password);
      const user = response.negocio;
      
      if (user.rol === 'admin' || user.rol === 'superadmin') {
        navigate('/admin/resumen', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-header-simple">
        <a href={import.meta.env.VITE_LANDING_URL || 'http://localhost:5173'} className="auth-logo-simple">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="24" fill="var(--accent-primary)" />
            <path d="M24 12L32 20L24 28L16 20L24 12Z" fill="var(--bg-primary)" />
          </svg>
          <span>ANTIGRAVITY</span>
        </a>
      </div>

      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="auth-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="var(--accent-primary)" />
              <path d="M24 12L32 20L24 28L16 20L24 12Z" fill="var(--bg-primary)" />
              <path d="M24 20L32 28L24 36L16 28L24 20Z" fill="var(--bg-primary)" opacity="0.6" />
            </svg>
            <span>ANTIGRAVITY</span>
          </div>
          <h1 className="auth-tagline">El sistema nervioso de tu negocio</h1>
          <ul className="auth-benefits">
            <li className="fade-up" style={{ animationDelay: '0.1s' }}>
              <span className="benefit-icon">🤖</span>
              Automatización con IA avanzada
            </li>
            <li className="fade-up" style={{ animationDelay: '0.2s' }}>
              <span className="benefit-icon">💬</span>
              Atención 24/7 por WhatsApp
            </li>
            <li className="fade-up" style={{ animationDelay: '0.3s' }}>
              <span className="benefit-icon">📈</span>
              Incrementa tus ventas automáticamente
            </li>
          </ul>
          <div className="auth-stats">
            <span className="stat-number">142</span>
            <span className="stat-label">negocios activos</span>
          </div>
        </div>
        <div className="auth-grid-bg"></div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-container">
          <h2>Bienvenido de vuelta</h2>
          <p className="auth-subtitle">Ingresa a tu cuenta para continuar</p>

          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div className="auth-error shake">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              }
              required
            />

            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }
              required
            />

            <div className="auth-options">
              <label className="checkbox-wrapper">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="checkbox-custom"></span>
                Recordarme
              </label>
              <Link to="/forgot-password" className="auth-link">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <Button type="submit" fullWidth loading={loading}>
              INICIAR SESIÓN
            </Button>
          </form>

          <div className="auth-separator">
            <span>¿Eres nuevo aquí?</span>
          </div>

          <Link to="/register">
            <Button variant="outline" fullWidth>
              CREAR MI CUENTA
            </Button>
          </Link>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <a
              href={import.meta.env.VITE_LANDING_URL || 'http://localhost:5173'}
              className="auth-link"
              style={{ fontSize: '12px' }}
            >
              ← Volver a la página principal
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
