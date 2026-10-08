import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import './InfoPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const TIPOS = ['Restaurante', 'Tienda', 'Servicios', 'Salud', 'Belleza', 'Otro'];

const BENEFICIOS = [
  { t: 'Toma pedidos solo', d: 'Tu asistente atiende en WhatsApp 24/7, confirma pagos y arma el pedido.' },
  { t: 'Domicilios con mapa', d: 'Ruta, tarifa por km y seguimiento en vivo para tu cliente.' },
  { t: 'Desde $25.000 al mes', d: 'Planes pensados para negocios pequeños. Sin contratos largos.' },
];

export default function InfoPage() {
  const [params] = useSearchParams();
  const fuente = params.get('f') || 'instagram';
  const [form, setForm] = useState({ nombre: '', negocio: '', whatsapp: '', ciudad: '', tipo_negocio: '', mensaje: '', sitio_web: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await axios.post(`${API_URL}/api/public/interesados`, { ...form, fuente });
      setListo(true);
    } catch (err) {
      setError(err.response?.data?.error || 'No pudimos enviar tus datos. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="info-page">
      <header className="info-header">
        <Link to="/" className="info-logo">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle cx="24" cy="24" r="24" fill="#E53935" />
            <path d="M24 12L32 20L24 28L16 20L24 12Z" fill="#FFFFFF" />
          </svg>
          <span>ANTIGRAVITY</span>
        </Link>
      </header>

      <main className="info-main">
        <section className="info-hero">
          <span className="info-chip">Asistente de WhatsApp con IA</span>
          <h1>Que tu WhatsApp venda mientras tú descansas</h1>
          <p>Déjanos tus datos y te contamos cómo funciona para tu negocio. Sin compromiso.</p>
          <ul className="info-benefits">
            {BENEFICIOS.map((b) => (
              <li key={b.t}>
                <strong>{b.t}</strong>
                <span>{b.d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="info-card" aria-live="polite">
          {listo ? (
            <div className="info-done">
              <div className="info-check" aria-hidden="true">✓</div>
              <h2>¡Listo, {form.nombre.split(' ')[0]}!</h2>
              <p>Recibimos tus datos. Te escribimos por WhatsApp muy pronto para contarte todo.</p>
            </div>
          ) : (
            <form onSubmit={enviar} noValidate>
              <h2>Quiero saber más</h2>
              <p className="info-sub">Te respondemos por WhatsApp.</p>

              <label>
                Tu nombre
                <input value={form.nombre} onChange={set('nombre')} autoComplete="name" required maxLength={120} placeholder="Ej. María Gómez" />
              </label>
              <label>
                Nombre de tu negocio
                <input value={form.negocio} onChange={set('negocio')} required maxLength={150} placeholder="Ej. Sabores de Mocoa" />
              </label>
              <label>
                Tu WhatsApp
                <input value={form.whatsapp} onChange={set('whatsapp')} inputMode="tel" autoComplete="tel" required placeholder="300 123 4567" />
              </label>
              <div className="info-row">
                <label>
                  Ciudad
                  <input value={form.ciudad} onChange={set('ciudad')} autoComplete="address-level2" maxLength={80} placeholder="Mocoa" />
                </label>
                <label>
                  Tipo de negocio
                  <select value={form.tipo_negocio} onChange={set('tipo_negocio')}>
                    <option value="">Elige uno</option>
                    {TIPOS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
              </div>
              <label>
                ¿Qué te gustaría resolver? <span className="info-opt">(opcional)</span>
                <textarea value={form.mensaje} onChange={set('mensaje')} rows={3} maxLength={1000} placeholder="Ej. Me escriben muchos clientes y no alcanzo a responder" />
              </label>

              {/* Campo trampa para bots: las personas no lo ven. */}
              <input className="info-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.sitio_web} onChange={set('sitio_web')} name="sitio_web" />

              {error && <div className="info-error" role="alert">{error}</div>}
              <button type="submit" className="info-submit" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Quiero que me contacten'}
              </button>
              <p className="info-legal">Usamos tus datos solo para contactarte sobre Antigravity.</p>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
