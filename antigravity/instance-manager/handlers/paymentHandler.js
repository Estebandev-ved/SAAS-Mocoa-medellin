const db = require('../../db/config');

async function verificarPago(imagenBase64, negocioId, totalEsperado) {
  try {
    const response = await fetch('http://localhost:8000/verificar-pago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imagen_base64: imagenBase64,
        negocio_id: negocioId,
        total_esperado: totalEsperado
      })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[PaymentHandler] Error verificando pago:', error.message);
    return { valido: false, error: error.message };
  }
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
