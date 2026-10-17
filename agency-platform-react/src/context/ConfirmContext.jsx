import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import BottomSheet from '../components/BottomSheet'

const ConfirmContext = createContext(() => Promise.resolve(true))
export const useConfirm = () => useContext(ConfirmContext)

// Reemplazo de window.confirm: un diálogo propio (hoja inferior en celular) que devuelve una
// promesa. `await confirmar({ titulo, mensaje, boton, peligro })` → true si aceptó.
// Solo se usa para lo destructivo o irreversible; lo reversible se resuelve con "Deshacer".
export function ConfirmProvider({ children }) {
  const [estado, setEstado] = useState(null)
  const resolver = useRef(null)

  const confirmar = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve
    setEstado(typeof opts === 'string' ? { mensaje: opts } : opts)
  }), [])

  const cerrar = (valor) => {
    resolver.current?.(valor)
    resolver.current = null
    setEstado(null)
  }

  const peligro = estado?.peligro !== false
  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <BottomSheet abierto={!!estado} onCerrar={() => cerrar(false)} titulo={estado?.titulo || '¿Estás seguro?'} z={95}>
        <div className="flex gap-3 items-start mb-5">
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${peligro ? 'bg-danger/10 text-danger-text' : 'bg-accent-dim text-accent'}`}>
            {peligro ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
          </span>
          <p className="text-sm text-muted leading-6 m-0">{estado?.mensaje}</p>
        </div>
        <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end">
          <button onClick={() => cerrar(false)} className="h-12 px-5 rounded-xl bg-white border border-border text-text text-sm font-semibold cursor-pointer">
            {estado?.cancelar || 'Mejor no'}
          </button>
          <button
            autoFocus
            onClick={() => cerrar(true)}
            className={`h-12 px-5 rounded-xl text-white text-sm font-semibold border-none cursor-pointer ${peligro ? 'bg-danger hover:opacity-90' : 'bg-accent hover:bg-accent2'}`}
          >
            {estado?.boton || 'Sí, continuar'}
          </button>
        </div>
      </BottomSheet>
    </ConfirmContext.Provider>
  )
}
