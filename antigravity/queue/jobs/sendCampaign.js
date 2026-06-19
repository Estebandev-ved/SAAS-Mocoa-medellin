const { campaignQueue } = require('../index');

async function enqueueCampaign(campañaId, negocioId) {
  const db = require('../../db/config');
  
  const [campañas] = await db.execute(
    'SELECT * FROM campañas WHERE id = ? AND negocio_id = ?',
    [campañaId, negocioId]
  );
  
  if (campañas.length === 0) {
    throw new Error('Campaña no encontrada');
  }
  
  const campaña = campañas[0];
  
  if (campaña.estado === 'enviando' || campaña.estado === 'completada') {
    console.log(`[CampaignJob] Campaña ${campañaId} ya está ${campaña.estado}`);
    return null;
  }
  
  let delay = 0;
  if (campaña.fecha_envio) {
    const fechaEnvio = new Date(campaña.fecha_envio);
    const ahora = new Date();
    delay = Math.max(0, fechaEnvio.getTime() - ahora.getTime());
  }
  
  const job = await campaignQueue.add({
    campañaId,
    negocioId
  }, {
    delay,
    removeOnComplete: false
  });
  
  console.log(`[CampaignJob] Encolada campaña ${campañaId} para negocio ${negocioId}, Job ID: ${job.id}`);
  
  return job;
}

async function getCampaignStatus(campañaId, negocioId) {
  const db = require('../../db/config');
  
  const [campañas] = await db.execute(
    'SELECT * FROM campañas WHERE id = ? AND negocio_id = ?',
    [campañaId, negocioId]
  );
  
  if (campañas.length === 0) {
    return null;
  }
  
  const campaña = campañas[0];
  
  return {
    id: campaña.id,
    nombre: campaña.nombre,
    estado: campaña.estado,
    total: campaña.total_destinatarios,
    enviados: campaña.total_enviados,
    fallidos: campaña.total_fallidos,
    porcentaje: campaña.total_destinatarios > 0 
      ? Math.round((campaña.total_enviados / campaña.total_destinatarios) * 100) 
      : 0
  };
}

async function cancelCampaign(campañaId, negocioId) {
  const db = require('../../db/config');
  
  const [result] = await db.execute(
    `UPDATE campañas SET estado = 'cancelada' WHERE id = ? AND negocio_id = ? AND estado IN ('borrador', 'programada')`,
    [campañaId, negocioId]
  );
  
  return result.affectedRows > 0;
}

module.exports = {
  enqueueCampaign,
  getCampaignStatus,
  cancelCampaign
};
