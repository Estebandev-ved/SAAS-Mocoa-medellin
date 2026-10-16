import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

// Tour guiado con "foco": oscurece la pantalla y resalta cada elemento marcado con
// data-tour="..." mientras explica para qué sirve. Se muestra una vez por dispositivo y se
// puede repetir desde la Guía de uso (/dashboard?tour=1). Los pasos cuyo elemento no está
// visible (p. ej. el menú lateral en el celular) se saltan solos.
const CLAVE = 'noma_tour_dashboard_visto'

export const tourVisto = () => {
  try { return localStorage.getItem(CLAVE) === '1' } catch { return true }
}
const marcarVisto = () => {
  try { localStorage.setItem(CLAVE, '1') } catch { /* sin almacenamiento */ }
}

const buscar = (selector) => {
  for (const el of document.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

export default function ProductTour({ pasos, activo, onTerminar }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const visibles = pasos.filter((p) => buscar(p.selector))
  const paso = visibles[i]

  const medir = useCallback(() => {
    const el = paso && buscar(paso.selector)
    if (!el) return setRect(null)
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [paso])

  useLayoutEffect(() => {
    if (!activo || !paso) return undefined
    const el = buscar(paso.selector)
    el?.scrollIntoView({ block: 'center', behavior: 'instant' in document.documentElement ? 'instant' : 'auto' })
    const raf = requestAnimationFrame(medir)
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [activo, paso, medir])

  const terminar = useCallback(() => {
    marcarVisto()
    setI(0)
    onTerminar?.()
  }, [onTerminar])

  useEffect(() => {
    if (!activo) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') terminar()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') setI((n) => (n + 1 >= visibles.length ? (terminar(), 0) : n + 1))
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activo, visibles.length, terminar])

  if (!activo || !paso) return null

  const margen = 8
  const alto = typeof window !== 'undefined' ? window.innerHeight : 800
  const ancho = typeof window !== 'undefined' ? window.innerWidth : 400
  const debajo = rect ? rect.top + rect.height + 16 + 190 < alto : true
  const ultimo = i === visibles.length - 1
  const ancha = Math.min(340, ancho - 32)
  const izq = rect ? Math.min(Math.max(16, rect.left), ancho - ancha - 16) : 16

  return createPortal(
    <AnimatePresence>
      <motion.div key="tour" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-label="Tour guiado">
        {/* Foco: el recuadro transparente proyecta una sombra enorme que oscurece el resto */}
        {rect && (
          <div
            className="absolute rounded-2xl pointer-events-none transition-all duration-200"
            style={{
              top: rect.top - margen, left: rect.left - margen,
              width: rect.width + margen * 2, height: rect.height + margen * 2,
              boxShadow: '0 0 0 9999px rgba(10,10,10,0.68)', outline: '2px solid #E53935',
            }}
          />
        )}
        <div className="absolute inset-0" onClick={terminar} />
        <div
          className="absolute bg-white text-text rounded-2xl p-4 shadow-[0_16px_48px_rgba(10,10,10,0.4)]"
          style={{
            width: ancha, left: izq,
            ...(rect ? (debajo ? { top: rect.top + rect.height + 16 } : { bottom: alto - rect.top + 16 }) : { top: '30%' }),
          }}
        >
          <p className="text-[11px] font-semibold tracking-[0.04em] uppercase text-accent mb-1">Paso {i + 1} de {visibles.length}</p>
          <h3 className="text-base font-bold mb-1 m-0">{paso.titulo}</h3>
          <p className="text-sm text-muted leading-5 mb-4 m-0">{paso.texto}</p>
          <div className="flex items-center gap-2">
            <button onClick={terminar} className="h-11 px-3 rounded-xl bg-transparent border-none text-muted text-sm font-semibold cursor-pointer">
              Saltar
            </button>
            <div className="flex-1" />
            {i > 0 && (
              <button onClick={() => setI(i - 1)} className="h-11 px-4 rounded-xl bg-white border border-border text-text text-sm font-semibold cursor-pointer">
                Atrás
              </button>
            )}
            <button onClick={() => (ultimo ? terminar() : setI(i + 1))} className="h-11 px-5 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold border-none cursor-pointer">
              {ultimo ? '¡Listo!' : 'Siguiente'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
