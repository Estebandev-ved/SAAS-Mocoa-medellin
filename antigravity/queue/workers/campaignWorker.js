const db = require('../../db/config');

async function campaignWorker(queue) {
  queue.process(async (job) => {
    const { campañaId, negocioId } = job.data;
    
    console.log(`[CampaignWorker] Iniciando campaña ${campañaId} para negocio ${negocioId}`);
    
    const [negocios] = await db.execute(
      'SELECT * FROM negocios WHERE id = ?',
      [negocioId]
    );
    
    if (negocios.length === 0) {
      throw new Error('Negocio no encontrado');
    }
    
    const [campañas] = await db.execute(
      'SELECT * FROM campañas WHERE id = ? AND negocio_id = ?',
      [campañaId, negocioId]
    );
    
    if (campañas.length === 0) {
      throw new Error('Campaña no encontrada');
    }
    
    const campaña = campañas[0];
    
    await db.execute(
      `UPDATE campañas SET estado = 'enviando' WHERE id = ?`,
      [campañaId]
    );
    
    const clientes = await getSegmentoClientes(negocioId, campaña.segmento, campaña.segmento_config);
    
    console.log(`[CampaignWorker] ${clientes.length} destinatarios para campaña ${campañaId}`);
    
    const instanceManager = require('../../instance-manager/InstanceManager');
    let enviados = 0;
    let fallidos = 0;
    
    for (let i = 0; i < clientes.length; i++) {
      const cliente = clientes[i];
      
      try {
        await instanceManager.sendMessage(negocioId, cliente.whatsapp, campaña.mensaje);
        
        await delay(2000 + Math.random() * 3000);
        
        enviados++;
        
        if (i % 10 === 0) {
          const progreso = Math.round((enviados / clientes.length) * 100);
          job.progress(progreso);
          
          await db.execute(
            `UPDATE campañas SET total_enviados = ? WHERE id = ?`,
            [enviados, campañaId]
          );
        }
      } catch (error) {
        console.error(`[CampaignWorker] Error enviando a ${cliente.whatsapp}:`, error.message);
        fallidos++;
        
        await db.execute(
          `UPDATE campañas SET total_fallidos = ? WHERE id = ?`,
          [fallidos, campañaId]
        );
      }
    }
    
    await db.execute(
      `UPDATE campañas SET estado = 'completada', total_enviados = ?, total_fallidos = ? WHERE id = ?`,
      [enviados, fallidos, campañaId]
    );
    
    console.log(`[CampaignWorker] Campaña ${campañaId} completada: ${enviados} enviados, ${fallidos} fallidos`);
    
    return {
      success: true,
      enviados,
      fallidos,
      total: clientes.length
    };
  });
}

async function getSegmentoClientes(negocioId, segmento, segmentoConfig) {
  const config = typeof segmentoConfig === 'string' ? JSON.parse(segmentoConfig) : segmentoConfig || {};
  
  let query = 'SELECT * FROM clientes WHERE negocio_id = ?';
  const params = [negocioId];
  
  switch (segmento) {
    case 'todos':
      break;
      
    case 'inactivos':
      query += ' AND ultimo_pedido IS NOT NULL';
      if (config.dias) {
        query += ' AND DATEDIFF(NOW(), ultimo_pedido) > ?';
        params.push(config.dias || 30);
      } else {
        query += ' AND DATEDIFF(NOW(), ultimo_pedido) > 30';
      }
      break;
      
    case 'nuevos':
      query += ' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)';
      params.push(config.dias || 30);
      break;
      
    case 'compraron_x':
      if (config.producto_id) {
        query += ` AND id IN (
          SELECT DISTINCT p.cliente_id FROM pedidos p
          JOIN items_pedido ip ON p.id = ip.pedido_id
          WHERE p.negocio_id = ? AND ip.producto_id = ?
        )`;
        params.push(negocioId, config.producto_id);
      }
      break;
      
    default:
      break;
  }
  
  query += ' ORDER BY created_at DESC';
  
  const [clientes] = await db.execute(query, params);
  return clientes;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = campaignWorker;
