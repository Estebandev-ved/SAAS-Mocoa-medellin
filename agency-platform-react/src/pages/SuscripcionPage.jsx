import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Illustration from '../components/Illustration';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';
import TipNova from '../components/TipNova';
import EstadoCard from '../components/suscripcion/EstadoCard';
import UsoCard from '../components/suscripcion/UsoCard';
import PlanCard from '../components/suscripcion/PlanCard';
import HistorialCard from '../components/suscripcion/HistorialCard';
import CambioPlanModal from '../components/suscripcion/CambioPlanModal';
import CheckoutModal from '../components/suscripcion/CheckoutModal';
import PagoResultado from '../components/suscripcion/PagoResultado';
import CancelarModal from '../components/suscripcion/CancelarModal';
import { mensajeDeError } from '../components/suscripcion/format';

const ORDEN = ['emprendedor', 'starter', 'professional', 'enterprise'];

// Cómo se relaciona cada plan con el que tiene el negocio. Mientras no haya un
// ciclo pagado (prueba, vencida, sin activar) ningún plan es "el actual":
// cualquiera se paga completo.
function relacionCon(plan, sub) {
  if (['trial', 'vencida', 'inactiva'].includes(sub.estado)) return 'elegir';
  const i = ORDEN.indexOf(plan.id);
  const actual = ORDEN.indexOf(sub.plan);
  if (i === actual) return 'actual';
  return i > actual ? 'sube' : 'baja';
}

export default function SuscripcionPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { updateUser } = useAuth();

  const [sub, setSub] = useState(null);
  const [uso, setUso] = useState(null);
  const [planes, setPlanes] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [toast, setToast] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const [cambio, setCambio] = useState(null); // { planId, info, cargando, error }
  const [pago, setPago] = useState(null); // resultado al volver de la pasarela: { fase, planNombre, hasta }
  const [revisando, setRevisando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const planesRef = useRef(null);

  const cerrarToast = useCallback(() => setToast(null), []);

  const cargarUnaVez = useCallback(async () => {
    const [s, u, p, f, h] = await Promise.all([
      api.get('/suscripcion/actual'),
      api.get('/suscripcion/uso'),
      api.get('/suscripcion/planes'),
      api.get('/suscripcion/facturas').catch(() => ({ data: [] })),
      api.get('/suscripcion/historial').catch(() => ({ data: [] })),
    ]);
    setSub(s.data);
    setUso(u.data);
    setPlanes(p.data);
    setFacturas(f.data);
    setHistorial(h.data);
    setErrorCarga(false);
    return s.data;
  }, []);

  // Un fallo aislado (red inestable, 429 por un pico de peticiones en otra
  // pestaña) no debería tirar la pantalla entera a la vista de error: se
  // reintenta una vez antes de rendirse.
  const cargar = useCallback(async () => {
    try {
      return await cargarUnaVez();
    } catch {
      try {
        await new Promise((r) => setTimeout(r, 1500));
        return await cargarUnaVez();
      } catch {
        setErrorCarga(true);
        return null;
      }
    } finally {
      setCargando(false);
    }
  }, [cargarUnaVez]);

  useEffect(() => { cargar(); }, [cargar]);

  // Regreso desde la pasarela (Efipay/Stripe). El plan lo activa el webhook, que puede tardar unos
  // segundos (o no llegar en desarrollo local): con Efipay se le pregunta además el estado
  // directo, y se vuelve a consultar hasta ver la suscripción activa. El resultado se cuenta con
  // personajes (PagoResultado) en vez de un aviso que desaparece solo.
  // Se procesa una sola vez por carga de página. NO depende de la limpieza del efecto: al borrar
  // los parámetros de la URL (setParams) el efecto se vuelve a ejecutar y su limpieza cancelaba
  // la verificación en curso, así que el resultado nunca llegaba a mostrarse.
  const retornoProcesado = useRef(false);
  useEffect(() => {
    const exito = params.get('success') === 'true';
    const cancelado = params.get('cancelled') === 'true';
    if ((!exito && !cancelado) || retornoProcesado.current) return;
    retornoProcesado.current = true;
    setParams({}, { replace: true });

    if (cancelado) {
      setPago({ fase: 'cancelado' });
      return;
    }

    setPago({ fase: 'verificando' });
    (async () => {
      for (let i = 0; i < 6; i += 1) {
        if (i % 2 === 0) await api.post('/stripe/efipay/verificar').catch(() => {});
        const s = await cargar();
        if (s?.estado === 'activa') {
          updateUser({ plan: s.plan });
          setPago({ fase: 'exito', planNombre: s.plan_nombre, hasta: s.acceso_hasta || s.proximo_pago });
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      setPago((actual) => (actual?.fase === 'verificando' ? { fase: 'pendiente' } : actual));
    })();
  }, [params, setParams, cargar, updateUser]);

  // "Revisar ahora" desde la pantalla de pago pendiente: una consulta directa a Efipay.
  async function revisarPago() {
    setRevisando(true);
    try {
      await api.post('/stripe/efipay/verificar').catch(() => {});
      const s = await cargar();
      if (s?.estado === 'activa') {
        updateUser({ plan: s.plan });
        setPago({ fase: 'exito', planNombre: s.plan_nombre, hasta: s.acceso_hasta || s.proximo_pago });
      } else {
        setToast({ type: 'error', message: 'Todavía no llega la confirmación. Sigue en camino; puedes revisar de nuevo en un momento.' });
      }
    } finally {
      setRevisando(false);
    }
  }

  async function abrirCambio(planId) {
    setCambio({ planId, info: null, cargando: true, error: null });
    try {
      const { data } = await api.get(`/suscripcion/cambio/${planId}`);
      setCambio({ planId, info: data, cargando: false, error: null });
    } catch (err) {
      setCambio({ planId, info: null, cargando: false, error: mensajeDeError(err, 'No pudimos calcular ese cambio. Intenta de nuevo.') });
    }
  }

  async function abrirPortal() {
    try {
      const { data } = await api.post('/stripe/portal');
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setToast({ type: 'error', message: mensajeDeError(err, 'No pudimos abrir el portal de facturación.') });
    }
  }

  async function confirmarCambio() {
    const { planId, info } = cambio;
    setOcupado(true);
    try {
      if (info.tipo === 'downgrade') {
        const { data } = await api.post('/suscripcion/downgrade', { plan: planId });
        setToast({ type: 'success', message: data.mensaje });
      } else {
        const { data } = await api.post('/stripe/checkout', { plan: planId });
        if (data.url) {
          window.location.href = data.url; // Stripe real
          return;
        }
        updateUser({ plan: planId });
        setToast({ type: 'success', message: data.mensaje });
      }
      setCambio(null);
      await cargar();
    } catch (err) {
      if (err.response?.data?.codigo === 'USAR_PORTAL') {
        setCambio(null);
        await abrirPortal();
      } else {
        setCambio((c) => c && { ...c, error: mensajeDeError(err, 'No se pudo completar el cambio.') });
      }
    } finally {
      setOcupado(false);
    }
  }

  async function accion(fn, mensajeError) {
    setOcupado(true);
    try {
      const { data } = await fn();
      setToast({ type: 'success', message: data.mensaje });
      await cargar();
      return true;
    } catch (err) {
      const codigo = err.response?.data?.codigo;
      setToast({ type: 'error', message: mensajeDeError(err, mensajeError) });
      if (codigo === 'PAGO_REQUERIDO') irAPlanes();
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const irAPlanes = () => planesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  async function cancelarSuscripcion(motivo) {
    const ok = await accion(() => api.post('/suscripcion/cancelar', { motivo }), 'No se pudo cancelar la suscripción.');
    if (ok) setCancelando(false);
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Illustration name="carga" size={170} alt="Cargando" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            aria-label="Volver al dashboard"
            className="p-2 rounded-xl bg-bg2 border border-border hover:border-accent/30 hover:bg-accent/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div>
            <h1 className="font-head text-3xl font-bold mb-1">Suscripción</h1>
            <p className="text-muted">Tu plan, tu uso y tu facturación en un solo lugar</p>
          </div>
        </header>

        <TipNova id="suscripcion" className="mb-6">Acá ves cuánto llevas de tu ciclo, cambias de plan cuando quieras (subir es inmediato, bajar se programa para el fin del ciclo) y revisas tus facturas.</TipNova>

        {errorCarga || !sub ? (
          <EmptyState
            name="error"
            title="No pudimos cargar tu suscripción"
            description="Revisa tu conexión e intenta de nuevo."
            action={
              <button
                onClick={() => { setCargando(true); cargar(); }}
                className="h-11 px-6 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold transition-colors"
              >
                Reintentar
              </button>
            }
          />
        ) : (
          <div className="space-y-6">
            <EstadoCard
              sub={sub}
              ocupado={ocupado}
              onElegirPlan={irAPlanes}
              onCancelar={() => setCancelando(true)}
              onReactivar={() => accion(() => api.post('/suscripcion/reactivar'), 'No se pudo reactivar la suscripción.')}
              onDeshacerCambio={() => accion(() => api.post('/suscripcion/downgrade/cancelar'), 'No se pudo deshacer el cambio.')}
            />

            <UsoCard uso={uso} />

            <section ref={planesRef} aria-labelledby="planes-titulo" className="scroll-mt-6">
              <h2 id="planes-titulo" className="font-head text-2xl font-bold text-text mb-1">Planes</h2>
              <p className="text-muted text-sm mb-6">
                Precios en pesos colombianos, por mes. Puedes cambiar de plan cuando quieras.
              </p>
              <div className="grid gap-6 md:grid-cols-3 pt-3">
                {planes.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    relacion={relacionCon(plan, sub)}
                    onSelect={abrirCambio}
                    bloqueado={ocupado}
                  />
                ))}
              </div>
              {sub.modo_pagos === 'no_disponible' && (
                <p className="mt-4 text-sm text-warn-text">
                  Los pagos en línea no están disponibles ahora mismo. Escríbenos y activamos tu plan.
                </p>
              )}
            </section>

            <HistorialCard facturas={facturas} historial={historial} />

            <footer className="flex items-center justify-between gap-4 flex-wrap text-sm text-muted pb-4">
              {sub.tiene_facturacion_stripe && sub.modo_pagos === 'stripe' ? (
                <button onClick={abrirPortal} className="inline-flex items-center gap-1 font-semibold text-accent hover:text-accent2 transition-colors">
                  <ExternalLink size={14} /> Gestionar tarjeta y facturas en Stripe
                </button>
              ) : <span />}
              {sub.modo_pagos === 'emulado' && (
                <span className="h-7 px-3 rounded-full bg-bg3 text-xs font-semibold inline-flex items-center">
                  Pagos de prueba · solo desarrollo
                </span>
              )}
            </footer>
          </div>
        )}
      </div>

      {cambio && (() => {
        // Bajar de plan no es una compra: conserva el modal de siempre. Pagar (activar o mejorar)
        // usa el checkout con Sofía. Mientras carga la info se deduce por el orden de los planes.
        const esBaja = cambio.info
          ? cambio.info.tipo === 'downgrade'
          : !['trial', 'vencida', 'inactiva'].includes(sub?.estado) && ORDEN.indexOf(cambio.planId) < ORDEN.indexOf(sub?.plan);
        const Modal = esBaja ? CambioPlanModal : CheckoutModal;
        return (
          <Modal
            info={cambio.info}
            cargando={cambio.cargando}
            error={cambio.error}
            modo={sub?.modo_pagos}
            enviando={ocupado}
            onConfirm={confirmarCambio}
            onClose={() => setCambio(null)}
          />
        );
      })()}

      {pago && (
        <PagoResultado
          fase={pago.fase}
          planNombre={pago.planNombre}
          hasta={pago.hasta}
          revisando={revisando}
          onRevisar={revisarPago}
          onElegirPlan={() => { setPago(null); irAPlanes(); }}
          onClose={() => setPago(null)}
        />
      )}

      {cancelando && (
        <CancelarModal
          sub={sub}
          enviando={ocupado}
          onConfirm={cancelarSuscripcion}
          onClose={() => setCancelando(false)}
        />
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={cerrarToast} duration={5000} />}
    </div>
  );
}
