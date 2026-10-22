import { useEffect, useRef, useState } from 'react';
import { Send, RotateCcw, FastForward, FlaskConical } from 'lucide-react';
import api from '../../services/api';

// "Probar flujo": conversas como si fueras un cliente con el flujo que estás editando (aunque no esté guardado).
// No envía nada por WhatsApp ni toca clientes reales: el servidor corre el mismo motor en memoria.
export default function SimuladorFlujo({ definicion }) {
  const [mensajes, setMensajes] = useState([]);
  const [ejec, setEjec] = useState(null);
  const [etiquetas, setEtiquetas] = useState([]);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const fin = useRef(null);

  useEffect(() => { fin.current?.scrollIntoView?.({ block: 'nearest' }); }, [mensajes]);

  const empezar = () => { setMensajes([]); setEjec(null); setEtiquetas([]); setError(''); setTexto(''); };

  const enviar = async (modo, textoCliente) => {
    setOcupado(true);
    setError('');
    try {
      const { data } = await api.post('/flujos/simular', { definicion, modo, texto: textoCliente, ejec, etiquetas, nombre: 'Cliente de prueba' });
      setMensajes((m) => [...m, ...(modo === 'mensaje' ? [{ de: 'cliente', texto: textoCliente }] : []), ...data.mensajes]);
      setEjec(data.ejec);
      setEtiquetas(data.etiquetas || []);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo probar el flujo');
    } finally {
      setOcupado(false);
    }
  };

  const mandar = (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || ocupado) return;
    setTexto('');
    enviar('mensaje', t);
  };

  return (
    <section className="rounded-2xl border border-[#C9C9C9] bg-white p-4" aria-label="Probar flujo">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="font-head text-lg text-text flex items-center gap-2"><FlaskConical className="w-4 h-4 text-accent" /> Probar flujo</h2>
        <button type="button" onClick={empezar} className="h-9 px-3 rounded-lg border border-[#C9C9C9] bg-white text-xs text-text inline-flex items-center gap-1 cursor-pointer">
          <RotateCcw className="w-3.5 h-3.5" /> Empezar de nuevo
        </button>
      </div>
      <p className="text-xs text-muted mb-3">Escribe como si fueras un cliente. No se envía nada a WhatsApp. Usa el flujo que ves en pantalla, aunque no lo hayas guardado.</p>

      <div className="h-64 overflow-y-auto rounded-xl bg-bg2 p-3 space-y-2" aria-live="polite">
        {mensajes.length === 0 && <p className="text-xs text-muted">Prueba escribiendo la palabra clave del flujo.</p>}
        {mensajes.map((m, i) => (
          m.de === 'sistema'
            ? <p key={i} className="text-xs text-muted text-center">{m.texto}</p>
            : (
              <div key={i} className={`flex ${m.de === 'cliente' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] whitespace-pre-line rounded-xl px-3 py-2 text-sm ${m.de === 'cliente' ? 'bg-accent text-white' : 'bg-white text-text border border-[#C9C9C9]'}`}>{m.texto}</div>
              </div>
            )
        ))}
        <div ref={fin} />
      </div>

      {etiquetas.length > 0 && <p className="text-xs text-muted mt-2">Etiquetas del cliente de prueba: {etiquetas.join(', ')}</p>}
      {error && <p className="text-xs text-danger mt-2" role="alert">{error}</p>}

      {ejec?.estado === 'esperando_tiempo' && (
        <button type="button" onClick={() => enviar('saltar_espera')} disabled={ocupado}
          className="mt-2 h-10 px-3 rounded-lg border border-accent text-accent bg-white text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-50">
          <FastForward className="w-4 h-4" /> Saltar la espera
        </button>
      )}

      <form onSubmit={mandar} className="flex gap-2 mt-3">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} placeholder="Escribe como cliente…" aria-label="Mensaje del cliente de prueba"
          className="flex-1 min-h-[44px] bg-white border border-[#C9C9C9] rounded-xl px-3 text-sm text-text focus:outline-none focus:border-accent" />
        <button type="submit" disabled={ocupado || !texto.trim()} aria-label="Enviar mensaje de prueba"
          className="h-11 w-11 rounded-xl bg-accent text-white inline-flex items-center justify-center border-none cursor-pointer disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </section>
  );
}
