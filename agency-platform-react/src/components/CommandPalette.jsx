import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ShoppingCart, Users, Package, CornerDownLeft, Moon, Sun } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { PANTALLAS, esRutaDueno } from '../utils/nav'
import { useTema } from '../hooks/useTema'

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Paleta de comandos (Ctrl/Cmd+K): salta a cualquier
// pantalla y busca pedidos, clientes y productos. Los datos se piden la primera vez que se
// abre y se reutilizan.
export default function CommandPalette() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { oscuro, alternar } = useTema()
  const [abierta, setAbierta] = useState(false)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const [datos, setDatos] = useState(null)
  const inputRef = useRef(null)
  const habilitada = !!user && esRutaDueno(pathname)

  const cerrar = useCallback(() => { setAbierta(false); setQ(''); setIdx(0) }, [])

  useEffect(() => {
    if (!habilitada) return undefined
    const abrir = () => setAbierta(true)
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAbierta((a) => !a)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('abrir-paleta', abrir)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('abrir-paleta', abrir)
    }
  }, [habilitada])

  useEffect(() => {
    if (!abierta) return
    setTimeout(() => inputRef.current?.focus(), 30)
    if (datos) return
    let vivo = true
    Promise.allSettled([api.get('/pedidos'), api.get('/clientes'), api.get('/productos')]).then(([p, c, pr]) => {
      if (!vivo) return
      setDatos({
        pedidos: p.value?.data?.pedidos || [],
        clientes: c.value?.data?.clientes || [],
        productos: pr.value?.data?.productos || pr.value?.data?.data || [],
      })
    })
    return () => { vivo = false }
  }, [abierta, datos])

  const resultados = useMemo(() => {
    const t = norm(q)
    const acciones = [
      { tipo: 'accion', icon: oscuro ? Sun : Moon, texto: oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro', accion: alternar },
    ].filter((a) => !t || norm(a.texto).includes(t) || 'tema oscuro claro'.includes(t))
    const pantallas = PANTALLAS.filter((p) => !t || norm(`${p.label} ${p.palabras}`).includes(t)).map((p) => ({
      tipo: 'pantalla', icon: p.icon, texto: p.label, sub: 'Ir a la pantalla', ir: p.path,
    }))
    if (!t) return [...pantallas.slice(0, 8), ...acciones]
    const pedidos = (datos?.pedidos || [])
      .filter((p) => norm(`${p.numero_pedido} ${p.cliente_nombre} ${p.cliente_whatsapp}`).includes(t))
      .slice(0, 5)
      .map((p) => ({ tipo: 'pedido', icon: ShoppingCart, texto: `Pedido #${p.numero_pedido || p.id}`, sub: `${p.cliente_nombre || 'Sin nombre'} · ${String(p.estado).replace('_', ' ')}`, ir: `/pedidos?q=${encodeURIComponent(p.numero_pedido || p.id)}` }))
    const clientes = (datos?.clientes || [])
      .filter((c) => norm(`${c.nombre} ${c.whatsapp}`).includes(t))
      .slice(0, 5)
      .map((c) => ({ tipo: 'cliente', icon: Users, texto: c.nombre || c.whatsapp, sub: c.whatsapp || 'Cliente', ir: '/clientes' }))
    const productos = (datos?.productos || [])
      .filter((p) => norm(`${p.nombre} ${p.categoria}`).includes(t))
      .slice(0, 5)
      .map((p) => ({ tipo: 'producto', icon: Package, texto: p.nombre, sub: `Producto${p.stock != null ? ` · stock ${p.stock}` : ''}`, ir: '/productos' }))
    return [...pantallas, ...pedidos, ...clientes, ...productos, ...acciones]
  }, [q, datos, oscuro, alternar])

  const elegir = (r) => {
    cerrar()
    if (r.accion) r.accion()
    else if (r.ir) navigate(r.ir)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') cerrar()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, resultados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && resultados[idx]) { e.preventDefault(); elegir(resultados[idx]) }
  }

  if (!habilitada) return null

  return (
    <AnimatePresence>
      {abierta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-black/50 flex items-start justify-center p-4 pt-[10vh]"
          onClick={cerrar}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Buscar y navegar"
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-white rounded-2xl shadow-[0_16px_48px_rgba(10,10,10,0.3)] overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 border-b border-border">
              <Search size={18} className="text-muted shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setIdx(0) }}
                onKeyDown={onKeyDown}
                placeholder="Busca una pantalla, pedido, cliente o producto…"
                aria-label="Buscar"
                className="flex-1 h-14 bg-transparent border-none outline-none text-base text-text"
              />
              <kbd className="hidden sm:inline text-[11px] text-muted border border-border rounded px-1.5 py-0.5">Esc</kbd>
            </div>
            <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2 list-none m-0">
              {resultados.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-muted">
                  {datos ? 'No encontramos nada con eso.' : 'Buscando…'}
                </li>
              )}
              {resultados.map((r, i) => {
                const Icon = r.icon
                return (
                  <li
                    key={`${r.tipo}-${r.texto}-${i}`}
                    role="option"
                    aria-selected={i === idx}
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => elegir(r)}
                    className={`flex items-center gap-3 px-3 min-h-[48px] rounded-xl cursor-pointer ${i === idx ? 'bg-accent-dim' : ''}`}
                  >
                    <Icon size={18} className={i === idx ? 'text-accent' : 'text-muted'} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-text truncate">{r.texto}</span>
                      {r.sub && <span className="block text-xs text-muted truncate">{r.sub}</span>}
                    </span>
                    {i === idx && <CornerDownLeft size={14} className="text-muted" />}
                  </li>
                )
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
