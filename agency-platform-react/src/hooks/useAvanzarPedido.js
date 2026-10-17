import { useCallback } from 'react'
import api from '../services/api'
import { useUndo } from '../context/UndoContext'
import { usePedidosLive } from '../context/PedidosLiveContext'

// Mismas transiciones que valida el backend (api/routes/orders.js)
export const SIGUIENTE_ESTADO = {
  pendiente_pago: { estado: 'pago_enviado', label: 'Marcar pago enviado' },
  pago_enviado: { estado: 'pago_confirmado', label: 'Confirmar pago' },
  pago_confirmado: { estado: 'en_preparacion', label: 'Marcar en preparación' },
  en_preparacion: { estado: 'enviado', label: 'Marcar enviado' },
  enviado: { estado: 'entregado', label: 'Marcar entregado' },
}

// Avanza un pedido con cambio optimista y "Deshacer": `poner(id, estado)` actualiza la lista local
// de quien lo usa; la llamada real se confirma pasados unos segundos (ver UndoContext).
export function useAvanzarPedido(poner) {
  const { diferir } = useUndo()
  const { refrescarPendientes } = usePedidosLive()

  return useCallback((pedido, nuevoEstado, mensaje) => {
    const anterior = pedido.estado
    poner(pedido.id, nuevoEstado)
    diferir({
      mensaje: mensaje || `Pedido #${pedido.numero_pedido || pedido.id} actualizado`,
      onDeshacer: () => poner(pedido.id, anterior),
      onConfirmar: async () => {
        await api.patch(`/pedidos/${pedido.id}/estado`, { estado: nuevoEstado })
        refrescarPendientes()
      },
    })
  }, [poner, diferir, refrescarPendientes])
}

// Texto corto para el botón de acción rápida de cada estado
export const ETIQUETA_RAPIDA = {
  pendiente_pago: 'Pago enviado',
  pago_enviado: 'Aprobar pago',
  pago_confirmado: 'Preparar',
  en_preparacion: 'Enviar',
  enviado: 'Entregado',
}
