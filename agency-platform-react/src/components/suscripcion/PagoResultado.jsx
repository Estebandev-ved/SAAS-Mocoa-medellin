import { Loader2, RefreshCw } from 'lucide-react';
import Modal from './Modal';
import Illustration, { Character } from '../Illustration';
import OwnerAvatar from '../avatar/OwnerAvatar';
import CheckBadge from '../CheckBadge';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from './format';

const BTN_PRIMARIO =
  'h-11 px-6 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
const BTN_SECUNDARIO =
  'h-11 px-5 rounded-xl bg-white hover:bg-bg2 text-text text-sm font-semibold border border-[#C9C9C9] transition-colors';

// Marco común de los personajes: mismo lenguaje que el modal de logros y los estados vacíos.
function Escena({ children, sello = false }) {
  return (
    <div className="relative mx-auto w-40 h-40 rounded-3xl bg-[#FDECEA] flex items-end justify-center overflow-visible">
      {children}
      {sello && <CheckBadge size={40} className="absolute -top-2 -right-2" />}
    </div>
  );
}

// fase: 'verificando' | 'exito' | 'pendiente' | 'cancelado'
export default function PagoResultado({ fase, planNombre, hasta, revisando, onRevisar, onElegirPlan, onClose }) {
  const { user } = useAuth();

  const titulos = {
    verificando: 'Confirmando tu pago',
    exito: '¡Pago recibido!',
    pendiente: 'Estamos confirmando tu pago',
    cancelado: 'No se completó el pago',
  };

  return (
    <Modal titulo={titulos[fase]} onClose={onClose}>
      <div className="text-center pb-1" role="status" aria-live="polite">
        {fase === 'verificando' && (
          <>
            <Illustration name="carga" size={120} alt="" />
            <p className="font-head text-lg font-bold text-text mt-5">Confirmando tu pago con Efipay…</p>
            <p className="text-sm text-muted mt-1 max-w-sm mx-auto">Suele tardar solo unos segundos. No cierres esta pantalla.</p>
          </>
        )}

        {fase === 'exito' && (
          <>
            <Escena sello>
              {/* Celebra tu propio avatar si ya tienes uno; si no, Sofía (misma regla que el toast de éxito). */}
              <div className="noma-hop -mt-6">
                {user?.avatar
                  ? <OwnerAvatar config={user.avatar} variant="busto" height={150} label="Tu avatar celebra" />
                  : <Character name="sofia" height={150} alt="Sofía celebra" />}
              </div>
            </Escena>
            <p className="font-head text-2xl font-bold text-text mt-6">¡Listo, ya eres {planNombre}!</p>
            <p className="text-sm text-muted mt-1 max-w-sm mx-auto">
              Tu plan está activo{hasta ? <> hasta el <strong className="text-text">{formatDate(hasta)}</strong></> : ''}. Tu bot ya puede
              seguir vendiendo con todo lo nuevo.
            </p>
            <div className="mt-6 flex justify-center">
              <button type="button" onClick={onClose} data-autofocus className={BTN_PRIMARIO}>Entendido</button>
            </div>
          </>
        )}

        {fase === 'pendiente' && (
          <>
            <Escena>
              <div className="pb-1"><Character name="nova" height={130} alt="Nova espera la confirmación" /></div>
            </Escena>
            <p className="font-head text-xl font-bold text-text mt-6">Recibimos tu pago, lo estamos confirmando</p>
            <p className="text-sm text-muted mt-1 max-w-sm mx-auto">
              A veces el banco tarda unos minutos. Tu plan se activa solo en cuanto llegue la confirmación,
              <strong className="text-text"> no tienes que pagar de nuevo</strong>.
            </p>
            <div className="mt-6 flex justify-center gap-3 flex-wrap">
              <button type="button" onClick={onClose} className={BTN_SECUNDARIO}>Cerrar</button>
              <button type="button" onClick={onRevisar} disabled={revisando} data-autofocus className={BTN_PRIMARIO}>
                {revisando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Revisar ahora
              </button>
            </div>
          </>
        )}

        {fase === 'cancelado' && (
          <>
            <Escena>
              <div className="pb-2"><Illustration name="error" size={120} framed={false} alt="Nova se disculpa" /></div>
            </Escena>
            <p className="font-head text-xl font-bold text-text mt-6">No se completó el pago</p>
            <p className="text-sm text-muted mt-1 max-w-sm mx-auto">
              <strong className="text-text">No se te cobró nada.</strong> Puede que lo hayas cancelado o que el banco no lo aprobara.
              Cuando quieras, vuelve a intentarlo.
            </p>
            <div className="mt-6 flex justify-center gap-3 flex-wrap">
              <button type="button" onClick={onClose} className={BTN_SECUNDARIO}>Cerrar</button>
              <button type="button" onClick={onElegirPlan} data-autofocus className={BTN_PRIMARIO}>Intentar de nuevo</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
