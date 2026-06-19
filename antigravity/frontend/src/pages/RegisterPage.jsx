import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { businessService } from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import './AuthPages.css';

const TIPOS_NEGOCIO = [
  { value: 'restaurante', label: 'Restaurante', icon: '🍽️' },
  { value: 'retail', label: 'Tienda/Retail', icon: '🏪' },
  { value: 'servicios', label: 'Servicios', icon: '💼' },
  { value: 'salud', label: 'Salud', icon: '🏥' },
  { value: 'inmobiliaria', label: 'Inmobiliaria', icon: '🏠' },
  { value: 'educacion', label: 'Educación', icon: '📚' },
  { value: 'otro', label: 'Otro', icon: '📦' }
];

const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá', 'Bolívar',
  'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar',
  'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila',
  'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
  'Putumayo', 'Quindío', 'Risaralda', 'San Andrés', 'Santander',
  'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada'
];

const CIudades = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Cúcuta',
  'Bucaramanga', 'Pereira', 'Manizales', 'Ibagué', 'Pasto', 'Neiva',
  'Popayán', 'Santa Marta', 'Valledupar', 'Montería', 'Sincelejo'
];

const PLANES = [
  {
    id: 'starter',
    nombre: 'Starter',
    precio: 450000,
    features: ['Bot de ventas básico', 'Hasta 100 clientes', 'Catálogo de productos', 'Reportes básicos']
  },
  {
    id: 'professional',
    nombre: 'Professional',
    precio: 850000,
    recomendado: true,
    features: ['Clientes ilimitados', 'Analytics avanzado', 'Automatizaciones', 'Personalización completa', 'Soporte prioritario']
  },
  {
    id: 'enterprise',
    nombre: 'Enterprise',
    precio: 1800000,
    features: ['Multi-sede', 'Integraciones', 'Equipo completo', 'Soporte 24/7', 'SLA garantizado']
  }
];

export default function RegisterPage() {
  const [paso, setPaso] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre: '',
    email_dueno: '',
    whatsapp: '',
    password: '',
    confirmPassword: '',
    terminos_aceptados: false,
    nombre_comercial: '',
    razon_social: '',
    nit: '',
    tipo_negocio: '',
    descripcion: '',
    ciudad: '',
    departamento: '',
    direccion: '',
    telefono: '',
    sitio_web: '',
    numero_empleados: '',
    volumen_pedidos: '',
    metodos_pago: [],
    numero_nequi: '',
    numero_bancolombia: '',
    tiene_catalogo: '',
    plan: 'professional',
    terminos_datos: false
  });

  const [passwordStrength, setPasswordStrength] = useState(0);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'password') {
      let strength = 0;
      if (value.length >= 8) strength++;
      if (/[A-Z]/.test(value)) strength++;
      if (/[0-9]/.test(value)) strength++;
      if (/[!@#$%^&*(),.?":{}|<>]/.test(value)) strength++;
      setPasswordStrength(strength);
    }
  };

  const toggleMetodoPago = (metodo) => {
    setFormData(prev => ({
      ...prev,
      metodos_pago: prev.metodos_pago.includes(metodo)
        ? prev.metodos_pago.filter(m => m !== metodo)
        : [...prev.metodos_pago, metodo]
    }));
  };

  const validarPaso = (p) => {
    if (p === 1) {
      return formData.nombre.length >= 3 &&
        formData.email_dueno.includes('@') &&
        /^\+57\d{10}$/.test(formData.whatsapp) &&
        formData.password.length >= 8 &&
        formData.password === formData.confirmPassword &&
        formData.terminos_aceptados;
    }
    if (p === 2) {
      return formData.nombre_comercial && formData.tipo_negocio;
    }
    if (p === 3) {
      return formData.numero_empleados && formData.volumen_pedidos;
    }
    return true;
  };

  const handleNext = async () => {
    if (!validarPaso(paso)) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }
    setError('');
    
    if (paso < 5) {
      setPaso(paso + 1);
    }
  };

  const handleBack = () => {
    if (paso > 1) {
      setPaso(paso - 1);
    }
  };

  const handleSubmit = async () => {
    if (!formData.terminos_datos) {
      setError('Debes aceptar los términos y condiciones');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await register({
        nombre: formData.nombre,
        email_dueno: formData.email_dueno,
        whatsapp: formData.whatsapp,
        password: formData.password,
        terminos_aceptados: true
      });

      await businessService.saveOnboardingStep(2, {
        nombre_comercial: formData.nombre_comercial,
        razon_social: formData.razon_social,
        nit: formData.nit,
        tipo_negocio: formData.tipo_negocio,
        descripcion: formData.descripcion,
        ciudad: formData.ciudad,
        departamento: formData.departamento,
        direccion: formData.direccion,
        telefono: formData.telefono,
        sitio_web: formData.sitio_web
      });

      await businessService.saveOnboardingStep(3, {
        numero_empleados: formData.numero_empleados,
        volumen_pedidos: formData.volumen_pedidos,
        metodos_pago: formData.metodos_pago,
        numero_nequi: formData.numero_nequi,
        numero_bancolombia: formData.numero_bancolombia
      });

      await businessService.saveOnboardingStep(4, { plan: formData.plan });
      await businessService.saveOnboardingStep(5, {});

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  const formatCOP = (valor) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(valor);
  };

  return (
    <div className="register-page">
      <div className="register-header">
      <a href={import.meta.env.VITE_LANDING_URL || 'http://localhost:5173'} className="register-logo">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="24" fill="var(--accent-primary)" />
            <path d="M24 12L32 20L24 28L16 20L24 12Z" fill="var(--bg-primary)" />
          </svg>
          <span>ANTIGRAVITY</span>
        </a>
      </div>

      <div className="progress-bar">
        {[1, 2, 3, 4, 5].map((p) => (
          <div key={p} className={`progress-step ${p <= paso ? 'active' : ''} ${p < paso ? 'completed' : ''}`}>
            <div className="progress-dot">{p < paso ? '✓' : p}</div>
            <div className="progress-line"></div>
          </div>
        ))}
      </div>

      <div className="register-container">
        {error && <div className="auth-error">{error}</div>}

        {paso === 1 && (
          <div className="register-step fade-up">
            <h2>¿Quién eres?</h2>
            <p className="step-subtitle">Tus datos personales y de acceso</p>
            
            <div className="form-grid">
              <Input
                label="Nombre completo"
                value={formData.nombre}
                onChange={(e) => updateField('nombre', e.target.value)}
                placeholder="Juan Pérez"
              />
              <Input
                label="Email del negocio"
                type="email"
                value={formData.email_dueno}
                onChange={(e) => updateField('email_dueno', e.target.value)}
                placeholder="juan@mitienda.com"
              />
              <Input
                label="WhatsApp"
                value={formData.whatsapp}
                onChange={(e) => updateField('whatsapp', e.target.value)}
                placeholder="+573001234567"
                hint="Formato: +57 seguido de 10 dígitos"
              />
              <div>
                <Input
                  label="Contraseña"
                  type="password"
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
                <div className="password-strength">
                  <div className="strength-bar">
                    <div className={`strength-fill str-${passwordStrength}`}></div>
                  </div>
                  <span className="strength-label">
                    {passwordStrength === 0 && 'Muy débil'}
                    {passwordStrength === 1 && 'Débil'}
                    {passwordStrength === 2 && 'Media'}
                    {passwordStrength === 3 && 'Fuerte'}
                    {passwordStrength === 4 && 'Muy fuerte'}
                  </span>
                </div>
              </div>
              <Input
                label="Confirmar contraseña"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                error={formData.confirmPassword && formData.password !== formData.confirmPassword ? 'Las contraseñas no coinciden' : ''}
              />
            </div>

            <label className="checkbox-wrapper">
              <input
                type="checkbox"
                checked={formData.terminos_aceptados}
                onChange={(e) => updateField('terminos_aceptados', e.target.checked)}
              />
              <span className="checkbox-custom"></span>
              Acepto los términos y condiciones
            </label>
          </div>
        )}

        {paso === 2 && (
          <div className="register-step fade-up">
            <h2>Tu negocio</h2>
            <p className="step-subtitle">Información legal y comercial</p>
            
            <div className="form-grid">
              <Input
                label="Nombre comercial"
                value={formData.nombre_comercial}
                onChange={(e) => updateField('nombre_comercial', e.target.value)}
                placeholder="Mi Tienda Colombia"
              />
              <Input
                label="Razón social (opcional)"
                value={formData.razon_social}
                onChange={(e) => updateField('razon_social', e.target.value)}
                placeholder="Mi Tienda SAS"
              />
              <Input
                label="NIT o Cédula"
                value={formData.nit}
                onChange={(e) => updateField('nit', e.target.value)}
                placeholder="900123456-7"
              />
              <div>
                <label className="input-label">Tipo de negocio</label>
                <div className="tipo-grid">
                  {TIPOS_NEGOCIO.map(tipo => (
                    <button
                      key={tipo.value}
                      type="button"
                      className={`tipo-option ${formData.tipo_negocio === tipo.value ? 'active' : ''}`}
                      onClick={() => updateField('tipo_negocio', tipo.value)}
                    >
                      <span className="tipo-icon">{tipo.icon}</span>
                      <span>{tipo.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">Descripción</label>
                <textarea
                  className="input-textarea"
                  value={formData.descripcion}
                  onChange={(e) => updateField('descripcion', e.target.value)}
                  placeholder="¿Qué vende tu negocio?"
                  maxLength={200}
                />
                <span className="char-count">{formData.descripcion.length}/200</span>
              </div>
              <select
                className="input-select"
                value={formData.departamento}
                onChange={(e) => updateField('departamento', e.target.value)}
              >
                <option value="">Seleccionar departamento</option>
                {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                className="input-select"
                value={formData.ciudad}
                onChange={(e) => updateField('ciudad', e.target.value)}
              >
                <option value="">Seleccionar ciudad</option>
                {CIudades.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <Input
                label="Dirección"
                value={formData.direccion}
                onChange={(e) => updateField('direccion', e.target.value)}
                placeholder="Calle 123 #45-67"
              />
              <Input
                label="Teléfono fijo (opcional)"
                value={formData.telefono}
                onChange={(e) => updateField('telefono', e.target.value)}
                placeholder="6012345678"
              />
              <Input
                label="Sitio web (opcional)"
                value={formData.sitio_web}
                onChange={(e) => updateField('sitio_web', e.target.value)}
                placeholder="https://mitienda.com"
              />
            </div>
          </div>
        )}

        {paso === 3 && (
          <div className="register-step fade-up">
            <h2>Tu operación</h2>
            <p className="step-subtitle">¿Cómo funciona tu negocio?</p>
            
            <div className="form-section">
              <label className="input-label">¿Cuántos pedidos recibes al día?</label>
              <div className="slider-options">
                {['1-10', '11-50', '51-200', '200+'].map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`slider-option ${formData.volumen_pedidos === v ? 'active' : ''}`}
                    onClick={() => updateField('volumen_pedidos', v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <label className="input-label">¿Cuántas personas atienden WhatsApp?</label>
              <div className="slider-options">
                {['1', '2-5', '6-20', '21-50', '50+'].map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`slider-option ${formData.numero_empleados === v ? 'active' : ''}`}
                    onClick={() => updateField('numero_empleados', v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-section">
              <label className="input-label">Métodos de pago</label>
              <div className="checkbox-grid">
                {['Nequi', 'Bancolombia', 'Bold', 'Wompi', 'Efectivo'].map(m => (
                  <label key={m} className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={formData.metodos_pago.includes(m.toLowerCase())}
                      onChange={() => toggleMetodoPago(m.toLowerCase())}
                    />
                    <span className="checkbox-card-custom">
                      <span className="check-icon">✓</span>
                    </span>
                    <span>{m}</span>
                  </label>
                ))}
              </div>
              {formData.metodos_pago.includes('nequi') && (
                <Input
                  label="Número Nequi"
                  value={formData.numero_nequi}
                  onChange={(e) => updateField('numero_nequi', e.target.value)}
                  placeholder="3101234567"
                />
              )}
              {formData.metodos_pago.includes('bancolombia') && (
                <Input
                  label="Número Bancolombia"
                  value={formData.numero_bancolombia}
                  onChange={(e) => updateField('numero_bancolombia', e.target.value)}
                  placeholder="3101234567"
                />
              )}
            </div>
          </div>
        )}

        {paso === 4 && (
          <div className="register-step fade-up">
            <h2>Elige tu plan</h2>
            <p className="step-subtitle">Comienza con 7 días gratis</p>
            
            <div className="plans-grid">
              {PLANES.map(plan => (
                <div
                  key={plan.id}
                  className={`plan-card ${formData.plan === plan.id ? 'selected' : ''} ${plan.recomendado ? 'recommended' : ''}`}
                  onClick={() => updateField('plan', plan.id)}
                >
                  {plan.recomendado && <span className="plan-badge">RECOMENDADO</span>}
                  <h3 className="plan-name">{plan.nombre}</h3>
                  <div className="plan-price">
                    <span className="price-value">{formatCOP(plan.precio)}</span>
                    <span className="price-period">/mes</span>
                  </div>
                  <ul className="plan-features">
                    {plan.features.map((f, i) => (
                      <li key={i}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={formData.plan === plan.id ? 'primary' : 'outline'}
                    fullWidth
                  >
                    Seleccionar
                  </Button>
                </div>
              ))}
            </div>

            <p className="trial-text">
              Empieza con 7 días gratis, cancela cuando quieras.
            </p>
          </div>
        )}

        {paso === 5 && (
          <div className="register-step fade-up">
            <h2>Todo listo</h2>
            <p className="step-subtitle">Confirma y crea tu cuenta</p>

            <div className="summary-card">
              <div className="summary-header">
                <div className="summary-avatar">
                  {formData.nombre_comercial?.charAt(0) || 'N'}
                </div>
                <div>
                  <h3>{formData.nombre_comercial}</h3>
                  <span className="summary-plan">{PLANES.find(p => p.id === formData.plan)?.nombre}</span>
                </div>
              </div>
              <div className="summary-details">
                <div className="summary-item">
                  <span className="summary-label">Email</span>
                  <span>{formData.email_dueno}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">WhatsApp</span>
                  <span>{formData.whatsapp}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Ciudad</span>
                  <span>{formData.ciudad}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Métodos de pago</span>
                  <div className="summary-tags">
                    {formData.metodos_pago.map(m => (
                      <span key={m} className="summary-tag">{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <label className="checkbox-wrapper">
              <input
                type="checkbox"
                checked={formData.terminos_aceptados}
                onChange={(e) => updateField('terminos_aceptados', e.target.checked)}
              />
              <span className="checkbox-custom"></span>
              Acepto los términos y condiciones y la política de privacidad
            </label>

            <label className="checkbox-wrapper">
              <input
                type="checkbox"
                checked={formData.terminos_datos}
                onChange={(e) => updateField('terminos_datos', e.target.checked)}
              />
              <span className="checkbox-custom"></span>
              Autorizo el tratamiento de datos personales según la Ley 1581 de 2012
            </label>
          </div>
        )}

        <div className="register-actions">
          {paso > 1 && (
            <Button variant="ghost" onClick={handleBack}>
              Atrás
            </Button>
          )}
          {paso < 5 ? (
            <Button onClick={handleNext} disabled={!validarPaso(paso)}>
              Continuar
            </Button>
          ) : (
            <Button onClick={handleSubmit} loading={loading}>
              CREAR MI CUENTA
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
