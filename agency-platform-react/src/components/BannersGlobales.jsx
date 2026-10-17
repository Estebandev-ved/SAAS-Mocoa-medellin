import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CreditCard, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePedidosLive } from '../context/PedidosLiveContext'

// Franja superior del panel: recordatorio de renovación (el aviso de "sin conexión" es OfflineBanner)
// (el backend lo manda por socket como `subscription_alert`). Se puede descartar por sesión.
export default function BannersGlobales() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { alertaSuscripcion } = usePedidosLive()
  const [descartada, setDescartada] = useState(null) // el aviso descartado (uno nuevo vuelve a mostrarse)

  if (!user) return null
  const mostrarRenovar = !!alertaSuscripcion && descartada !== alertaSuscripcion && pathname !== '/suscripcion'

  return (
    <div className="sticky top-14 lg:top-0 z-[39]">
      {mostrarRenovar && (
        <div role="alert" className="bg-warn/15 border-b border-warn/40 text-text text-sm px-4 py-2 flex items-center gap-3">
          <CreditCard size={16} className="text-warn-text shrink-0" />
          <span className="flex-1">{alertaSuscripcion.mensaje || 'Tu plan está por vencer. Renuévalo para que tu bot no se detenga.'}</span>
          <button onClick={() => navigate('/suscripcion')} className="h-9 px-3 rounded-lg bg-accent text-white text-xs font-semibold border-none cursor-pointer">
            Renovar ahora
          </button>
          <button onClick={() => setDescartada(alertaSuscripcion)} aria-label="Cerrar aviso" className="w-9 h-9 rounded-lg bg-transparent border-none text-muted cursor-pointer flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
