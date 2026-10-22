import { useCallback } from 'react'
import api from '../services/api'
import { useUndo } from '../context/UndoContext'
import { usePedidosLive } from '../context/PedidosLiveContext'
import { useHitos } from '../context/HitosContext'

// Mismas transiciones que valida el backend (api/routes/orders.js)
export const SIGUIENTE_ESTADO = {
  pendiente_pago: { estado: 'pago_enviado', label: 'Marcar pago enviado' },
  pago_enviado: { estado: 'pago_confirmado', label: 'Confirmar pago' },
  pago_confirmado: { estado: 'en_preparacion', label: 'Marcar en preparación' },
  en_preparacion: { estado: 'enviado', label: 'Marcar enviado' },
  enviado: { estado: 'entregado', label: 'Marcar entregado' },
}

const ESTADOS_PAGADOS = ['pago_confirmado', 'en_preparacion', 'enviado', 'entregado']

// Pedidos con un avance pendiente de confirmar (compartido entre pantallas): evita que un doble toque
// encadene dos transiciones y que "Deshacer" deje el pedido en un estado intermedio.
const enCurso = new Set()

// Avanza un pedido con cambio optimista y "Deshacer": `poner(id, estado)` actualiza la lista local
// de quien lo usa; la llamada real se confirma pasados unos segundos (ver UndoContext).
export function useAvanzarPedido(poner) {
  const { diferir, avisarError } = useUndo()
  const { refrescarPendientes } = usePedidosLive()
  const { celebrar } = useHitos()

  return useCallback((pedido, nuevoEstado, mensaje) => {
    if (enCurso.has(pedido.id)) {
      avisarError('Este pedido ya se está actualizando. Espera unos segundos o deshaz el cambio anterior.')
      return
    }
    enCurso.add(pedido.id)
    const anterior = pedido.estado
    poner(pedido.id, nuevoEstado)
    diferir({
      mensaje: mensaje || `Pedido #${pedido.numero_pedido || pedido.id} actualizado`,
      onDeshacer: () => {
        enCurso.delete(pedido.id)
        poner(pedido.id, anterior)
      },
      onConfirmar: async () => {
        try {
          await api.patch(`/pedidos/${pedido.id}/estado`, { estado: nuevoEstado })
          if (ESTADOS_PAGADOS.includes(nuevoEstado)) celebrar('venta_cobrada')
          refrescarPendientes()
        } finally {
          enCurso.delete(pedido.id)
        }
      },
    })
  }, [poner, diferir, avisarError, refrescarPendientes, celebrar])
}

// Texto corto para el botón de acción rápida de cada estado
export const ETIQUETA_RAPIDA = {
  pendiente_pago: 'Pago enviado',
  pago_enviado: 'Aprobar pago',
  pago_confirmado: 'Preparar',
  en_preparacion: 'Enviar',
  enviado: 'Entregado',
}
