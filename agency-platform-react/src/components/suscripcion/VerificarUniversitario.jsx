import { useEffect, useState } from 'react';
import { GraduationCap, Loader2, MailCheck } from 'lucide-react';
import api from '../../services/api';
import { mensajeDeError } from './format';

const INPUT =
  'w-full h-11 bg-white border border-[#C9C9C9] rounded-xl px-4 text-base text-text placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';
const BTN =
  'h-11 px-5 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

// Paso previo al pago del plan Universitario: el estudiante demuestra que lo es con el correo de su
// universidad. Se manda un código de 6 dígitos a ese correo y, al escribirlo, queda verificado un semestre.
export default function VerificarUniversitario({ onVerificado }) {
  const [fase, setFase] = useState('correo'); // correo | codigo
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  // Si ya había pedido un código (cerró el modal y volvió), retoma donde iba.
  useEffect(() => {
    api.get('/suscripcion/universitario').then(({ data }) => {
      if (data.correo) setCorreo(data.correo);
      if (data.codigo_pendiente) setFase('codigo');
    }).catch(() => {});
  }, []);

  async function pedirCodigo(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const { data } = await api.post('/suscripcion/universitario/codigo', { correo });
      setCorreo(data.correo);
      setFase('codigo');
      setAviso(data.codigo_dev
        ? `Modo desarrollo (sin correo configurado): tu código es ${data.codigo_dev}`
        : `Te mandamos un código a ${data.correo}. Revisa también la carpeta de spam.`);
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos enviar el código. Intenta de nuevo.'));
    } finally {
      setEnviando(false);
    }
  }

  async function verificar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await api.post('/suscripcion/universitario/verificar', { codigo });
      onVerificado?.();
    } catch (err) {
      setError(mensajeDeError(err, 'No pudimos verificar el código.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-bg2 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
          <GraduationCap size={20} aria-hidden="true" />
        </div>
        <div>
          <p className="font-head text-base font-bold text-text">Primero, verifica que eres estudiante</p>
          <p className="text-sm text-muted">
            Usa el correo que te dio tu universidad (por ejemplo, <span className="font-mono">tu@unal.edu.co</span>). Vale por un semestre.
          </p>
        </div>
      </div>

      {fase === 'correo' ? (
        <form onSubmit={pedirCodigo} className="flex gap-2 flex-wrap" noValidate>
          <label htmlFor="correo-universidad" className="sr-only">Correo de la universidad</label>
          <input
            id="correo-universidad" type="email" inputMode="email" autoComplete="email" required maxLength={190}
            className={`${INPUT} flex-1 min-w-[200px]`} placeholder="tu@universidad.edu.co"
            value={correo} onChange={(e) => setCorreo(e.target.value)}
          />
          <button type="submit" disabled={enviando || !correo.trim()} className={BTN}>
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <MailCheck size={16} aria-hidden="true" />}
            Enviarme el código
          </button>
        </form>
      ) : (
        <form onSubmit={verificar} className="space-y-2" noValidate>
          {aviso && <p className="text-sm text-text" role="status">{aviso}</p>}
          <div className="flex gap-2 flex-wrap">
            <label htmlFor="codigo-universidad" className="sr-only">Código de 6 números</label>
            <input
              id="codigo-universidad" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
              className={`${INPUT} w-40 font-mono tracking-[0.3em] text-center`} placeholder="000000"
              value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            />
            <button type="submit" disabled={enviando || codigo.length !== 6} className={BTN}>
              {enviando && <Loader2 size={16} className="animate-spin" />}
              Verificar
            </button>
          </div>
          <button
            type="button" onClick={() => { setFase('correo'); setCodigo(''); setAviso(''); setError(''); }}
            className="text-sm text-muted underline bg-transparent border-none cursor-pointer min-h-11"
          >
            Cambiar el correo o pedir otro código
          </button>
        </form>
      )}

      {error && <p className="text-sm text-danger-text" role="alert">{error}</p>}
    </div>
  );
}
