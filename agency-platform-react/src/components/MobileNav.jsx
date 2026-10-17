import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, MessageSquare, Package, MoreHorizontal, LogOut, Search, Moon, Sun, Volume2, VolumeX } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePedidosLive, sonidoActivo, guardarSonidoActivo, reproducirAviso } from '../context/PedidosLiveContext'
import { PANTALLAS, esRutaDueno } from '../utils/nav'
import { useTema } from '../hooks/useTema'
import { useBranding } from '../context/BrandingContext'
import BottomSheet from './BottomSheet'

const PRINCIPALES = [
  { icon: LayoutDashboard, label: 'Inicio', path: '/dashboard' },
  { icon: ShoppingCart, label: 'Pedidos', path: '/pedidos', badge: true },
  { icon: MessageSquare, label: 'Chats', path: '/conversaciones' },
  { icon: Package, label: 'Productos', path: '/productos' },
]

// Menú inferior del celular para todas las pantallas del dueño (en escritorio se queda el
// menú lateral del Dashboard). Muestra cuántos pedidos esperan acción y deja el resto de
// pantallas, el tema y el sonido en una hoja "Más".
export default function MobileNav() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { pendientes } = usePedidosLive()
  const { oscuro, alternar } = useTema()
  const { updateBranding } = useBranding()
  const [mas, setMas] = useState(false)
  const [sonido, setSonido] = useState(sonidoActivo())
  const visible = !!user && esRutaDueno(pathname)

  useEffect(() => {
    document.body.classList.toggle('con-nav-inferior', visible)
    return () => document.body.classList.remove('con-nav-inferior')
  }, [visible])

  // El tema oscuro solo vale dentro del panel; la web pública conserva su aspecto de marca.
  useEffect(() => {
    const oscuroAhora = visible && oscuro
    document.documentElement.setAttribute('data-theme', oscuroAhora ? 'dark' : 'light')
    updateBranding({ theme: oscuroAhora ? 'dark' : 'light' })
  }, [visible, oscuro, updateBranding])

  if (!visible) return null

  const ir = (path) => { setMas(false); navigate(path) }
  const enPrincipales = PRINCIPALES.some((p) => p.path === pathname)

  return (
    <>
      <nav
        aria-label="Navegación principal"
        data-tour="menu-movil"
        className="lg:hidden fixed bottom-0 inset-x-0 z-[65] bg-inverse text-inverse-text border-t border-white/10 grid grid-cols-5"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        {PRINCIPALES.map(({ icon: Icon, label, path, badge }) => {
          const activo = pathname === path
          return (
            <button
              key={path}
              onClick={() => ir(path)}
              aria-current={activo ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 bg-transparent border-none cursor-pointer min-h-[44px] ${activo ? 'text-inverse-text' : 'text-[#A0A0A0]'}`}
            >
              <span className="relative">
                <Icon size={22} className={activo ? 'text-[#E53935]' : ''} />
                {badge && pendientes > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E53935] text-white text-[10px] font-bold flex items-center justify-center">
                    {pendientes > 9 ? '9+' : pendientes}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-semibold">{label}</span>
            </button>
          )
        })}
        <button
          onClick={() => setMas(true)}
          className={`flex flex-col items-center justify-center gap-0.5 bg-transparent border-none cursor-pointer min-h-[44px] ${!enPrincipales ? 'text-inverse-text' : 'text-[#A0A0A0]'}`}
        >
          <MoreHorizontal size={22} className={!enPrincipales ? 'text-[#E53935]' : ''} />
          <span className="text-[11px] font-semibold">Más</span>
        </button>
      </nav>

      <BottomSheet abierto={mas} onCerrar={() => setMas(false)} titulo="Más opciones" z={75}>
        <button
          onClick={() => { setMas(false); window.dispatchEvent(new CustomEvent('abrir-paleta')) }}
          className="w-full h-12 mb-4 px-4 rounded-xl bg-bg2 border border-border text-muted text-sm flex items-center gap-2 cursor-pointer"
        >
          <Search size={16} /> Buscar pantallas, pedidos, clientes…
        </button>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PANTALLAS.filter((p) => !PRINCIPALES.some((x) => x.path === p.path)).map(({ icon: Icon, label, path }) => (
            <button
              key={path}
              onClick={() => ir(path)}
              className={`min-h-[76px] rounded-2xl border flex flex-col items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer p-2 ${
                pathname === path ? 'bg-accent-dim border-accent/40 text-accent' : 'bg-white border-border text-text'
              }`}
            >
              <Icon size={22} />
              <span className="text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={alternar} className="flex-1 min-w-[140px] h-12 rounded-xl bg-bg2 border border-border text-text text-sm font-semibold cursor-pointer inline-flex items-center justify-center gap-2">
            {oscuro ? <Sun size={18} /> : <Moon size={18} />} {oscuro ? 'Tema claro' : 'Tema oscuro'}
          </button>
          <button
            onClick={() => { const v = !sonido; guardarSonidoActivo(v); setSonido(v); if (v) reproducirAviso('mensaje') }}
            className="flex-1 min-w-[140px] h-12 rounded-xl bg-bg2 border border-border text-text text-sm font-semibold cursor-pointer inline-flex items-center justify-center gap-2"
          >
            {sonido ? <Volume2 size={18} /> : <VolumeX size={18} />} {sonido ? 'Sonido activo' : 'Sonido apagado'}
          </button>
          <button onClick={logout} className="w-full h-12 rounded-xl bg-white border border-danger/40 text-danger-text text-sm font-semibold cursor-pointer inline-flex items-center justify-center gap-2">
            <LogOut size={18} /> Cerrar sesión
          </button>
        </div>
      </BottomSheet>
    </>
  )
}
