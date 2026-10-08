import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2, Store } from 'lucide-react';
import api from '../services/api';
import { usePlan } from '../components/PlanGate';
import Toast from '../components/Toast';
import { mensajeDeError } from '../components/suscripcion/format';

export default function CajaPage() {
  const navigate = useNavigate();
  const { hasFeature } = usePlan();
  const [abriendo, setAbriendo] = useState(false);
  const [toast, setToast] = useState(null);
  const [sinPlan, setSinPlan] = useState(false);

  // El plan del usuario viene del login; el servidor es quien decide de verdad
  // (responde 403 si el plan no incluye la caja), así que aquí solo se usa para
  // mostrar el mensaje correcto desde el principio.
  const incluida = hasFeature('caja') && !sinPlan;

  async function abrirCaja() {
    // La pestaña se abre ANTES de pedir el token, dentro del clic del usuario:
    // si se abriera después del await, el navegador la tomaría por un popup y
    // la bloquearía.
    const pestana = window.open('about:blank', '_blank');
    if (pestana) pestana.opener = null;

    setAbriendo(true);
    try {
      const { data } = await api.post('/caja/token');
      if (pestana) {
        pestana.location.href = data.url;
      } else {
        // Popups bloqueados del todo: se navega en esta misma pestaña.
        window.location.href = data.url;
      }
    } catch (err) {
      if (pestana) pestana.close();
      if (err?.response?.status === 403) setSinPlan(true);
      setToast({
        type: 'error',
        message: mensajeDeError(err, 'No pudimos abrir la caja. Intenta de nuevo.'),
      });
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <header className="sticky top-0 z-40 bg-bg2/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="tap-44 shrink-0 hover:bg-bg3 rounded-xl transition-colors"
            aria-label="Volver al dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div>
            <h1 className="font-head text-xl text-text">Caja</h1>
            <p className="text-xs text-muted">Inventario, ventas y plata de tu emprendimiento.</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <section className="bg-white border border-border rounded-2xl p-8 text-center max-w-xl mx-auto">
          <div className="w-14 h-14 bg-accent-dim rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Store className="w-7 h-7 text-accent" aria-hidden="true" />
          </div>

          {incluida ? (
            <>
              <h2 className="font-head text-2xl font-bold text-text">Abre tu caja</h2>
              <p className="text-muted text-sm mt-3">
                La caja se abre en una pestaña nueva. Entras con tu cuenta de Antigravity, sin volver a
                iniciar sesión.
              </p>
              <button
                onClick={abrirCaja}
                disabled={abriendo}
                className="mt-6 inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {abriendo ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                )}
                {abriendo ? 'Abriendo…' : 'Abrir la caja'}
              </button>
            </>
          ) : (
            <>
              <h2 className="font-head text-2xl font-bold text-text">La caja es del plan Emprendedor</h2>
              <p className="text-muted text-sm mt-3">
                Controla tu inventario, tus ventas y tu plata desde un solo lugar por $25.000 al mes.
              </p>
              <button
                onClick={() => navigate('/suscripcion')}
                className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold transition-colors"
              >
                Ver planes
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
