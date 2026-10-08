import { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import {
  pushSoportado, esIOS, estaInstalada, configPush,
  suscripcionActual, activarAvisos, desactivarAvisos,
} from '../utils/pushAvisos';

// Botón "Activar avisos" (Ajustes → Notificaciones): pedido nuevo y pago confirmado
// llegan al celular aunque la app esté cerrada. Si el servidor no tiene claves VAPID
// no muestra nada.
export default function AvisosPedidos() {
  const [cfg, setCfg] = useState(null);
  const [activo, setActivo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const c = await configPush();
        const sub = pushSoportado() ? await suscripcionActual() : null;
        if (vivo) { setCfg(c); setActivo(!!sub && Notification.permission === 'granted'); }
      } catch { /* sin config: queda oculto */ }
    })();
    return () => { vivo = false; };
  }, []);

  if (!cfg?.habilitado) return null;

  const iosSinInstalar = esIOS() && !estaInstalada();
  const soportado = pushSoportado();

  const alternar = async () => {
    setBusy(true); setMsg(null);
    try {
      if (activo) {
        await desactivarAvisos();
        setActivo(false);
        setMsg({ ok: true, t: 'Avisos desactivados en este dispositivo.' });
      } else {
        await activarAvisos(cfg.publicKey);
        setActivo(true);
        setMsg({ ok: true, t: 'Listo: te avisaremos de cada pedido nuevo y pago confirmado.' });
      }
    } catch (e) {
      const t = e.message === 'PERMISO_DENEGADO'
        ? 'Bloqueaste las notificaciones. Actívalas en la configuración del navegador para este sitio.'
        : e.message === 'SW_NO_DISPONIBLE'
          ? 'Los avisos solo funcionan en la versión publicada de la app.'
          : 'No se pudo cambiar los avisos. Intenta de nuevo.';
      setMsg({ ok: false, t });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-8 p-4 rounded-xl border border-white/10 bg-white/5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <BellRing className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-text">Avisos de pedidos en tu celular</h4>
          <p className="text-sm text-muted mt-1">
            Recibe una notificación cuando llegue un pedido nuevo o se confirme un pago, aunque tengas la app cerrada.
          </p>
          {iosSinInstalar && (
            <p className="text-xs text-muted mt-2">
              En iPhone primero instala la app: Compartir → «Agregar a inicio de pantalla», ábrela desde ahí y vuelve aquí.
            </p>
          )}
          {!soportado && !iosSinInstalar && (
            <p className="text-xs text-muted mt-2">Este navegador no soporta avisos.</p>
          )}
          {msg && <p className={`text-xs mt-2 ${msg.ok ? 'text-muted' : 'text-red-500'}`} role="status">{msg.t}</p>}
        </div>
        <button
          type="button"
          onClick={alternar}
          disabled={busy || !soportado || iosSinInstalar}
          className="min-h-[44px] px-4 inline-flex items-center justify-center gap-2 shrink-0 rounded-xl text-sm font-semibold bg-accent text-white disabled:bg-[#F0F0F0] disabled:text-muted disabled:cursor-not-allowed"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {activo ? 'Desactivar avisos' : 'Activar avisos'}
        </button>
      </div>
    </div>
  );
}
