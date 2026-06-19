const { emailQueue } = require('../index');

async function enqueueEmail(tipo, negocioId, data) {
  const db = require('../../db/config');
  
  const [negocios] = await db.execute(
    'SELECT email_dueno FROM negocios WHERE id = ?',
    [negocioId]
  );
  
  if (negocios.length === 0) {
    throw new Error('Negocio no encontrado');
  }
  
  const email = negocios[0].email_dueno;
  
  const job = await emailQueue.add({
    tipo,
    email,
    data: {
      ...data,
      negocio_id: negocioId
    }
  }, {
    priority: getPriorityByType(tipo)
  });
  
  console.log(`[EmailJob] Encolado: ${tipo} para negocio ${negocioId}, Job ID: ${job.id}`);
  
  return job;
}

function getPriorityByType(tipo) {
  const priorities = {
    nuevo_pedido: 1,
    pago_confirmado: 1,
    cuenta_bloqueada: 1,
    alerta_stock_bajo: 2,
    reporte_semanal: 3,
    bienvenida_nuevo_negocio: 1
  };
  
  return priorities[tipo] || 3;
}

async function enqueueNuevoPedido(negocioId, pedidoData) {
  return enqueueEmail('nuevo_pedido', negocioId, pedidoData);
}

async function enqueuePagoConfirmado(negocioId, pedidoData) {
  return enqueueEmail('pago_confirmado', negocioId, pedidoData);
}

async function enqueueAlertaStock(negocioId, productos) {
  return enqueueEmail('alerta_stock_bajo', negocioId, { productos });
}

async function enqueueReporteSemanal(negocioId) {
  return enqueueEmail('reporte_semanal', negocioId, {});
}

async function enqueueBienvenida(negocioId) {
  return enqueueEmail('bienvenida_nuevo_negocio', negocioId, {});
}

async function enqueueAlertaCuenta(negocioId, mensaje) {
  return enqueueEmail('cuenta_bloqueada', negocioId, { mensaje });
}

module.exports = {
  enqueueEmail,
  enqueueNuevoPedido,
  enqueuePagoConfirmado,
  enqueueAlertaStock,
  enqueueReporteSemanal,
  enqueueBienvenida,
  enqueueAlertaCuenta
};
