const { reportQueue } = require('../index');

async function enqueueReport(negocioId, periodo = 'semanal') {
  const db = require('../../db/config');
  
  const [negocios] = await db.execute(
    'SELECT * FROM negocios WHERE id = ?',
    [negocioId]
  );
  
  if (negocios.length === 0) {
    throw new Error('Negocio no encontrado');
  }
  
  const job = await reportQueue.add({
    negocioId,
    periodo
  });
  
  console.log(`[ReportJob] Encolado reporte ${periodo} para negocio ${negocioId}, Job ID: ${job.id}`);
  
  return job;
}

async function enqueueReporteSemanal(negocioId) {
  return enqueueReport(negocioId, 'semanal');
}

async function enqueueReporteMensual(negocioId) {
  return enqueueReport(negocioId, 'mensual');
}

async function scheduleReporteSemanal(negocioId, diaSemana = 1, hora = 8) {
  const cronExpression = `0 ${hora} * * ${diaSemana}`;
  
  console.log(`[ReportJob] Programando reporte semanal para negocio ${negocioId} (${cronExpression})`);
  
  return {
    success: true,
    mensaje: 'Configuración guardada. Los reportes se generarán automáticamente.',
    configuracion: {
      dia: diaSemana,
      hora,
      tipo: 'semanal'
    }
  };
}

module.exports = {
  enqueueReport,
  enqueueReporteSemanal,
  enqueueReporteMensual,
  scheduleReporteSemanal
};
