import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, MessageSquare, Package, Users, CheckCircle2, ChevronRight } from 'lucide-react'
import api from '../services/api'
import { usePedidosLive } from '../context/PedidosLiveContext'
import { Skeleton } from './Skeleton'

const DIAS_INACTIVO = 30
const STOCK_BAJO = 3

// Tarjeta "Qué hacer ahora": convierte los datos del negocio en tareas con un botón que lleva
// directo a la pantalla donde se resuelven. Se actualiza sola cuando llegan pedidos o mensajes.
export default function AccionesSugeridas() {
  const navigate = useNavigate()
  const { suscribir } = usePedidosLive()
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    let vivo = true
    const cargar = async () => {
      const [p, c, pr, cl] = await Promise.allSettled([
        api.get('/pedidos'), api.get('/conversaciones'), api.get('/productos'), api.get('/clientes'),
      ])
      if (!vivo) return
      const limite = Date.now() - DIAS_INACTIVO * 86400000
      const clientes = cl.value?.data?.clientes || []
      setDatos({
        inactivos: clientes.filter((c) => c.acepta_marketing && c.ultimo_pedido && new Date(c.ultimo_pedido).getTime() < limite).length,
        pedidos: p.value?.data?.pedidos || [],
        conversaciones: c.value?.data?.conversaciones || [],
        productos: pr.value?.data?.productos || pr.value?.data?.data || [],
      })
    }
    cargar()
    const off1 = suscribir('pedidos', cargar)
    const off2 = suscribir('mensajes', cargar)
    return () => { vivo = false; off1(); off2() }
  }, [suscribir])

  if (!datos) {
    return (
      <div className="rounded-2xl border border-border bg-white p-5 mb-6" role="status" aria-label="Cargando tareas">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-12 w-full mb-2" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  const porRevisar = datos.pedidos.filter((p) => p.estado === 'pago_enviado').length
  const porPreparar = datos.pedidos.filter((p) => p.estado === 'pago_confirmado').length
  const esperanPersona = datos.conversaciones.filter((c) => c.atencion_humana).length
  const pocoStock = datos.productos.filter((p) => p.activo !== 0 && p.activo !== false && Number(p.stock) <= STOCK_BAJO).length
  const inactivos = datos.inactivos

  const tareas = [
    porRevisar > 0 && { icon: ShoppingCart, urgente: true, texto: `${porRevisar} ${porRevisar === 1 ? 'comprobante por revisar' : 'comprobantes por revisar'}`, boton: 'Revisar', ir: '/pedidos?estado=pago_enviado' },
    porPreparar > 0 && { icon: ShoppingCart, urgente: true, texto: `${porPreparar} ${porPreparar === 1 ? 'pedido pagado por preparar' : 'pedidos pagados por preparar'}`, boton: 'Preparar', ir: '/pedidos?estado=pago_confirmado' },
    esperanPersona > 0 && { icon: MessageSquare, urgente: true, texto: `${esperanPersona} ${esperanPersona === 1 ? 'cliente espera' : 'clientes esperan'} a una persona`, boton: 'Atender', ir: '/conversaciones' },
    pocoStock > 0 && { icon: Package, texto: `${pocoStock} ${pocoStock === 1 ? 'producto con' : 'productos con'} poco stock`, boton: 'Reponer', ir: '/productos' },
    inactivos > 0 && { icon: Users, texto: `Reactivar ${inactivos} ${inactivos === 1 ? 'cliente' : 'clientes'} que no compra${inactivos === 1 ? '' : 'n'} hace ${DIAS_INACTIVO}+ días`, boton: 'Crear campaña', ir: '/campanas' },
  ].filter(Boolean)

  return (
    <section data-tour="acciones" aria-label="Qué hacer ahora" className="rounded-2xl border border-border bg-white p-5 mb-6">
      <h2 className="text-lg font-bold text-text mb-3 m-0">Qué hacer ahora</h2>
      {tareas.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted m-0">
          <CheckCircle2 size={18} className="text-success" /> Todo al día. Tu bot está atendiendo; aquí aparecerán las tareas que necesiten de ti.
        </p>
      ) : (
        <ul className="list-none m-0 p-0 space-y-2">
          {tareas.map((t) => {
            const Icon = t.icon
            return (
              <li key={t.texto}>
                <button
                  onClick={() => navigate(t.ir)}
                  className={`w-full min-h-[56px] px-4 py-2 rounded-xl border flex items-center gap-3 text-left cursor-pointer ${t.urgente ? 'bg-accent-dim border-accent/30' : 'bg-bg2 border-border'}`}
                >
                  <Icon size={20} className={t.urgente ? 'text-accent' : 'text-muted'} />
                  <span className="flex-1 text-sm font-medium text-text">{t.texto}</span>
                  <span className="text-xs font-semibold text-accent inline-flex items-center gap-0.5 whitespace-nowrap">{t.boton} <ChevronRight size={14} /></span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
