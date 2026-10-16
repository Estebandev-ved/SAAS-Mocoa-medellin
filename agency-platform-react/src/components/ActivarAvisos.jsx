import React, { useCallback, useEffect, useState } from 'react'
import { BellRing, BellOff, Loader2 } from 'lucide-react'
import api from '../services/api'

const base64aBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// Botón "Activar avisos": pide permiso, suscribe este dispositivo a Web Push y registra la
// suscripción en el backend (/api/push). Si el servidor no tiene claves VAPID, lo dice.
export default function ActivarAvisos() {
  const soportado = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const [estado, setEstado] = useState('cargando') // cargando | apagado | activo | bloqueado | sin_servidor | no_soportado
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  const revisar = useCallback(async () => {
    if (!soportado) return setEstado('no_soportado')
    try {
      const cfg = await api.get('/push/config')
      if (!cfg.data?.habilitado) return setEstado('sin_servidor')
      if (Notification.permission === 'denied') return setEstado('bloqueado')
      const reg = await navigator.serviceWorker.getRegistration('/sw.js') || await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      setEstado(sub && Notification.permission === 'granted' ? 'activo' : 'apagado')
    } catch {
      setEstado('apagado')
    }
  }, [soportado])

  useEffect(() => { revisar() }, [revisar])

  const activar = async () => {
    setOcupado(true)
    setError('')
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') return setEstado(permiso === 'denied' ? 'bloqueado' : 'apagado')
      const { data } = await api.get('/push/config')
      const reg = await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64aBytes(data.publicKey),
      }))
      await api.post('/push/subscribe', sub.toJSON())
      setEstado('activo')
    } catch (e) {
      setError(e?.response?.data?.error || 'No pudimos activar los avisos en este dispositivo. Intenta de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  const desactivar = async () => {
    setOcupado(true)
    setError('')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
        await sub.unsubscribe()
      }
      setEstado('apagado')
    } catch {
      setError('No pudimos desactivar los avisos.')
    } finally {
      setOcupado(false)
    }
  }

  const textos = {
    cargando: 'Revisando…',
    apagado: 'Recibe un aviso en este celular cuando llegue un pedido o un pago, aunque la app esté cerrada.',
    activo: 'Este dispositivo recibe avisos de pedidos y pagos, aunque la app esté cerrada.',
    bloqueado: 'Bloqueaste los avisos en el navegador. Actívalos desde el candado de la barra de direcciones y vuelve aquí.',
    sin_servidor: 'Los avisos aún no están habilitados en el servidor. Cuando el equipo los active, aparecerá el botón.',
    no_soportado: 'Este navegador no admite avisos. En iPhone, instala la app (Compartir → Añadir a pantalla de inicio) y ábrela desde allí.',
  }

  return (
    <div className="rounded-2xl border border-border bg-bg2 p-4 mb-6 flex items-center gap-4 flex-wrap">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${estado === 'activo' ? 'bg-success/15 text-success' : 'bg-accent-dim text-accent'}`}>
        {estado === 'activo' ? <BellRing size={22} /> : <BellOff size={22} />}
      </div>
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm font-bold text-text">Avisos en este dispositivo</p>
        <p className="text-xs text-muted leading-5">{textos[estado]}</p>
        {error && <p role="alert" className="text-xs text-danger-text mt-1">{error}</p>}
      </div>
      {(estado === 'apagado' || estado === 'activo') && (
        <button
          onClick={estado === 'activo' ? desactivar : activar}
          disabled={ocupado}
          className={`h-11 px-5 rounded-xl text-sm font-semibold cursor-pointer inline-flex items-center gap-2 disabled:opacity-60 ${
            estado === 'activo' ? 'bg-white border border-border text-text' : 'bg-accent text-white border-none hover:bg-accent2'
          }`}
        >
          {ocupado && <Loader2 size={16} className="animate-spin" />}
          {estado === 'activo' ? 'Desactivar' : 'Activar avisos'}
        </button>
      )}
    </div>
  )
}
