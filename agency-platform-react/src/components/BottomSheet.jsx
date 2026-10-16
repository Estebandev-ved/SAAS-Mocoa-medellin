import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

// Hoja inferior para celular (en pantallas grandes se comporta como un modal centrado).
// Se cierra con Escape, tocando el fondo o arrastrando hacia abajo.
export default function BottomSheet({ abierto, onCerrar, titulo, children, z = 70 }) {
  useEffect(() => {
    if (!abierto) return undefined
    const onKey = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto, onCerrar])

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ zIndex: z }}
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center"
          onClick={onCerrar}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 90 && onCerrar()}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-[0_-8px_40px_rgba(10,10,10,0.2)] max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="sticky top-0 bg-white z-10 pt-2 pb-1 px-5">
              <div className="w-10 h-1.5 rounded-full bg-border mx-auto mb-2 sm:hidden" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-text m-0">{titulo}</h2>
                <button
                  onClick={onCerrar}
                  aria-label="Cerrar"
                  className="w-11 h-11 rounded-xl bg-transparent border-none text-muted hover:bg-bg2 cursor-pointer flex items-center justify-center"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
