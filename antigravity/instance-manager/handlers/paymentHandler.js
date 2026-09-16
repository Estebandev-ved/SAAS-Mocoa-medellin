// NOTA: este módulo no está conectado al flujo real de mensajes.
// El manejo de pagos en vivo pasa por messageHandler.js -> orchestrator.js
// -> gemini.js (verificarPagoConImagen), que usa Gemini directamente.
// `verificarPago` dependía del servicio Python `brain/`, ya retirado del
// proyecto, así que queda devolviendo error sin intentar red. Las demás
// funciones (notificar*, registrarPagoEnviado, confirmarPago) son helpers
// de BD/WhatsApp independientes del brain y quedan disponibles por si se
// necesitan más adelante (ej. un botón de "marcar como pagado" en el
// dashboard).
const db = require('../../db/config');

async function verificarPago(imagenBase64, negocioId, totalEsperado) {
  return { valido: false, error: 'Servicio de verificación no disponible' };
}

async function notificarPagoConfirmado(negocioId, pedidoId, clienteWhatsapp) {
  const instanceManager = require('../InstanceManager');
  
  try {
    await instanceManager.sendMessage(
      negocioId,
      clienteWhatsapp,
      '✅ Tu pago ha sido confirmado. Tu pedido está en preparación y pronto te informaremos cuando esté listo para envío.'
    );
  } catch (error) {
    console.error('[PaymentHandler] Error enviando notificación:', error.message);
  }
}

async function notificarPagoPendiente(negocioId, pedidoId, clienteWhatsapp, total) {
  const instanceManager = require('../InstanceManager');
  
  try {
    await instanceManager.sendButtons(
      negocioId,
      clienteWhatsapp,
      `💰 Total a pagar: $${total.toLocaleString('es-CO')}\n\nPor favor realiza el pago y envíe el comprobante.`,
      [
        { id: 'pagar_nequi', texto: 'Pagar con Nequi' },
        { id: 'pagar_bancolombia', texto: 'Pagar con Bancolombia' },
        { id: 'ayuda_pago', texto: 'Necesito ayuda' }
      ]
    );
  } catch (error) {
    console.error('[PaymentHandler] Error enviando recordatorio:', error.message);
  }
}

async function registrarPagoEnviado(negocioId, pedidoId, metodoPago) {
  await db.execute(
    `UPDATE pedidos SET estado = 'pago_enviado', metodo_pago = ? WHERE id = ? AND negocio_id = ?`,
    [metodoPago, pedidoId, negocioId]
  );
}

async function confirmarPago(negocioId, pedidoId) {
  await db.execute(
    `UPDATE pedidos SET estado = 'pago_confirmado', updated_at = NOW() WHERE id = ? AND negocio_id = ?`,
    [pedidoId, negocioId]
  );

  const [pedido] = await db.execute(
    `SELECT p.*, c.whatsapp as cliente_whatsapp, c.nombre as cliente_nombre
     FROM pedidos p
     JOIN clientes c ON p.cliente_id = c.id
     WHERE p.id = ? AND p.negocio_id = ?`,
    [pedidoId, negocioId]
  );

  if (pedido.length > 0) {
    await notificarPagoConfirmado(negocioId, pedidoId, pedido[0].cliente_whatsapp);
  }

  return pedido[0];
}

module.exports = {
  verificarPago,
  notificarPagoConfirmado,
  notificarPagoPendiente,
  registrarPagoEnviado,
  confirmarPago
};
