import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Undo2, AlertCircle } from 'lucide-react'

const UndoContext = createContext({ diferir: () => {}, avisarError: () => {}, avisarOk: () => {} })
export const useUndo = () => useContext(UndoContext)

// Acciones "optimistas con deshacer": la pantalla cambia al instante y el cambio real
// (la llamada a la API) se confirma pasado un margen de gracia. Si la persona toca
// "Deshacer" antes, la llamada nunca se hace y la pantalla vuelve atrás. Si la API
// falla, se revierte y se avisa. Sirve para cambios que el servidor no permite revertir
// (p. ej. los estados de un pedido solo avanzan).
export function UndoProvider({ children }) {
  const [items, setItems] = useState([])
  const timers = useRef(new Map())
  const pendientes = useRef(new Map())

  const quitar = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const confirmar = useCallback(
    async (id) => {
      const p = pendientes.current.get(id)
      if (!p) return
      pendientes.current.delete(id)
      clearTimeout(timers.current.get(id))
      timers.current.delete(id)
      quitar(id)
      try {
        await p.onConfirmar()
      } catch (e) {
        p.onDeshacer?.()
        const msg = e?.response?.data?.error || 'No se pudo guardar el cambio, lo devolvimos a como estaba.'
        const eid = `e-${id}`
        setItems((prev) => [...prev, { id: eid, mensaje: msg, error: true }])
        setTimeout(() => quitar(eid), 5000)
      }
    },
    [quitar]
  )

  const diferir = useCallback(
    ({ mensaje, onConfirmar, onDeshacer, ms = 6000 }) => {
      const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      pendientes.current.set(id, { onConfirmar, onDeshacer })
      setItems((prev) => [...prev, { id, mensaje, ms }])
      timers.current.set(id, setTimeout(() => confirmar(id), ms))
      return id
    },
    [confirmar]
  )

  const deshacer = useCallback(
    (id) => {
      const p = pendientes.current.get(id)
      if (!p) return
      pendientes.current.delete(id)
      clearTimeout(timers.current.get(id))
      timers.current.delete(id)
      quitar(id)
      p.onDeshacer?.()
    },
    [quitar]
  )

  const avisarError = useCallback(
    (mensaje) => {
      const id = `e-${Date.now()}`
      setItems((prev) => [...prev, { id, mensaje, error: true }])
      setTimeout(() => quitar(id), 5000)
    },
    [quitar]
  )

  // Aviso informativo corto (sustituye a los alert() del navegador)
  const avisarOk = useCallback(
    (mensaje) => {
      const id = `o-${Date.now()}`
      setItems((prev) => [...prev, { id, mensaje, ok: true }])
      setTimeout(() => quitar(id), 3500)
    },
    [quitar]
  )

  // Al salir de la página (cierre o recarga) se confirma lo pendiente: lo que la persona
  // vio hecho no puede perderse en silencio.
  useEffect(() => {
    const vaciar = () => [...pendientes.current.keys()].forEach((id) => confirmar(id))
    window.addEventListener('pagehide', vaciar)
    return () => window.removeEventListener('pagehide', vaciar)
  }, [confirmar])

  return (
    <UndoContext.Provider value={{ diferir, avisarError, avisarOk }}>
      {children}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[80] flex flex-col gap-2 items-center w-[min(440px,calc(100vw-32px))] pointer-events-none"
        style={{ bottom: 'calc(var(--nav-inferior, 0px) + 16px)' }}
        aria-live="polite"
      >
        <AnimatePresence>
          {items.map((i) => (
            <motion.div
              key={i.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              role={i.error ? 'alert' : 'status'}
              className="pointer-events-auto w-full flex items-center gap-3 rounded-2xl bg-inverse text-inverse-text pl-4 pr-2 py-2 shadow-[0_8px_24px_rgba(10,10,10,0.3)]"
            >
              {i.error && <AlertCircle size={18} className="text-[#EF5350] shrink-0" />}
              <span className="text-sm flex-1">{i.mensaje}</span>
              {!i.error && !i.ok && (
                <button
                  onClick={() => deshacer(i.id)}
                  className="h-11 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-inverse-text text-sm font-semibold border-none cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Undo2 size={16} /> Deshacer
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </UndoContext.Provider>
  )
}
