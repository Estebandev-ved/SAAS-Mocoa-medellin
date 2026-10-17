import React, { useEffect, useRef, useState } from 'react'
import { Send, Loader2, RotateCcw, FlaskConical } from 'lucide-react'
import api from '../services/api'
import BottomSheet from './BottomSheet'
import { Character } from './Illustration'

const SUGERENCIAS = ['Hola, ¿qué venden?', '¿Cuáles son los precios?', '¿Hacen domicilios?', 'Quiero hacer un pedido']

// Chat de prueba con el bot real del negocio (usa su personalidad, agentes y catálogo, sin gastar
// WhatsApp ni crear clientes). Se manda el hilo de la conversación para que responda con contexto.
export default function BotPreview({ abierto, onCerrar }) {
  const [hilo, setHilo] = useState([]) // { rol: 'cliente' | 'bot', contenido, error? }
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const finRef = useRef(null)

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [hilo, cargando])

  const enviar = async (mensaje) => {
    const t = (mensaje ?? texto).trim()
    if (!t || cargando) return
    const previo = hilo.filter((m) => !m.error)
    setHilo((h) => [...h, { rol: 'cliente', contenido: t }])
    setTexto('')
    setCargando(true)
    try {
      const res = await api.post('/bot/test', { mensaje: t, historial: previo })
      setHilo((h) => [...h, { rol: 'bot', contenido: res.data.respuesta || '…', meta: res.data.agente_usado }])
    } catch (e) {
      setHilo((h) => [...h, { rol: 'bot', contenido: e?.response?.data?.error || 'No pude conectar con el bot. Intenta de nuevo.', error: true }])
    } finally {
      setCargando(false)
    }
  }

  return (
    <BottomSheet abierto={abierto} onCerrar={onCerrar} titulo="Probar mi bot" z={80}>
      <p className="text-xs text-muted mb-3 flex items-center gap-1.5">
        <FlaskConical size={14} /> Vista previa: así respondería tu bot a un cliente. No se envía nada por WhatsApp.
      </p>
      <div className="rounded-2xl bg-bg2 border border-border p-3 min-h-[220px] max-h-[45vh] overflow-y-auto space-y-3" aria-live="polite">
        {hilo.length === 0 && (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FDECEA] overflow-hidden flex items-end justify-center mb-3">
              <Character name="nova" height={70} alt="" />
            </div>
            <p className="text-sm text-muted mb-3">Escribe como si fueras un cliente, o elige una:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGERENCIAS.map((s) => (
                <button key={s} onClick={() => enviar(s)} className="h-10 px-3 rounded-full bg-white border border-border text-xs font-medium text-text cursor-pointer">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {hilo.map((m, i) => (
          <div key={i} className={`flex ${m.rol === 'cliente' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
              m.rol === 'cliente' ? 'bg-accent text-white rounded-br-md' : m.error ? 'bg-danger/10 border border-danger/30 text-text rounded-bl-md' : 'bg-white border border-border text-text rounded-bl-md'
            }`}>
              {m.contenido}
              {m.meta && m.meta !== 'none' && <span className="block text-[10px] text-muted mt-1">Agente: {m.meta}</span>}
            </div>
          </div>
        ))}
        {cargando && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white border border-border text-muted text-sm inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Escribiendo…
            </div>
          </div>
        )}
        <div ref={finRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); enviar() }} className="flex gap-2 mt-3">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={500}
          placeholder="Escribe un mensaje de prueba…"
          aria-label="Mensaje de prueba"
          className="flex-1 h-12 rounded-xl border border-border bg-bg px-4 text-base md:text-sm text-text focus:outline-none focus:border-accent"
        />
        <button type="submit" disabled={cargando || !texto.trim()} aria-label="Enviar" className="w-12 h-12 rounded-xl bg-accent text-white border-none cursor-pointer disabled:opacity-50 flex items-center justify-center">
          <Send size={18} />
        </button>
        {hilo.length > 0 && (
          <button type="button" onClick={() => setHilo([])} aria-label="Reiniciar conversación" title="Reiniciar" className="w-12 h-12 rounded-xl bg-white border border-border text-muted cursor-pointer flex items-center justify-center">
            <RotateCcw size={18} />
          </button>
        )}
      </form>
    </BottomSheet>
  )
}
