const db = require('../../db/config');

async function reportWorker(queue) {
  queue.process(async (job) => {
    const { negocioId, periodo } = job.data;
    
    console.log(`[ReportWorker] Generando reporte para negocio ${negocioId}`);
    
    const dias = periodo === 'semanal' ? 7 : periodo === 'mensual' ? 30 : 7;
    
    const [negocios] = await db.execute(
      'SELECT * FROM negocios WHERE id = ?',
      [negocioId]
    );
    
    if (negocios.length === 0) {
      throw new Error('Negocio no encontrado');
    }
    
    const negocio = negocios[0];
    
    const [analytics] = await db.execute(
      `SELECT * FROM analytics_diario 
       WHERE negocio_id = ? AND fecha >= DATE_SUB(NOW(), INTERVAL ? DAY)
       ORDER BY fecha`,
      [negocioId, dias]
    );
    
    const totalVentas = analytics.reduce((sum, a) => sum + parseFloat(a.total_ventas || 0), 0);
    const totalPedidos = analytics.reduce((sum, a) => sum + (a.total_pedidos || 0), 0);
    const totalMensajes = analytics.reduce((sum, a) => sum + (a.total_mensajes || 0), 0);
    
    const [topProductos] = await db.execute(
      `SELECT prod.nombre, SUM(ip.cantidad) as unidades, SUM(ip.subtotal) as ingresos
       FROM items_pedido ip
       JOIN pedidos p ON ip.pedido_id = p.id
       JOIN productos prod ON ip.producto_id = prod.id
       WHERE p.negocio_id = ? AND p.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY prod.id
       ORDER BY ingresos DESC
       LIMIT 5`,
      [negocioId, dias]
    );
    
    const [nuevosClientes] = await db.execute(
      `SELECT COUNT(*) as total FROM clientes 
       WHERE negocio_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [negocioId, dias]
    );
    
    const reporte = {
      periodo,
      dias,
      negocio: {
        nombre: negocio.nombre,
        plan: negocio.plan
      },
      metricas: {
        ventas_totales: totalVentas,
        pedidos_totales: totalPedidos,
        mensajes_totales: totalMensajes,
        clientes_nuevos: nuevosClientes[0]?.total || 0,
        promedio_ventas_dia: dias > 0 ? totalVentas / dias : 0,
        conversion: totalMensajes > 0 ? (totalPedidos / totalMensajes * 100).toFixed(2) : 0
      },
      top_productos: topProductos.map(p => ({
        nombre: p.nombre,
        unidades: p.unidades,
        ingresos: parseFloat(p.ingresos || 0)
      })),
      analytics_diario: analytics.map(a => ({
        fecha: a.fecha,
        mensajes: a.total_mensajes,
        pedidos: a.total_pedidos,
        ventas: parseFloat(a.total_ventas || 0)
      }))
    };
    
    const csv = generarCSV(reporte);
    
    const emailData = {
      numero_pedido: `${periodo}-${negocioId}`,
      cliente_nombre: negocio.nombre,
      total: totalVentas,
      metodo_pago: 'reporte',
      productos: topProductos.map(p => ({
        nombre: p.nombre,
        stock: p.unidades
      }))
    };
    
    const { sendEmail } = require('./emailWorker');
    await sendEmail('reporte_semanal', negocio.email_dueno, {
      ventas: totalVentas,
      pedidos: totalPedidos,
      clientes_nuevos: nuevosClientes[0]?.total || 0
    });
    
    console.log(`[ReportWorker] Reporte generado para negocio ${negocioId}`);
    
    return {
      success: true,
      reporte,
      csv_length: csv.length
    };
  });
}

function generarCSV(reporte) {
  let csv = 'Fecha,Mensajes,Pedidos,Ventas\n';
  
  for (const dia of reporte.analytics_diario) {
    csv += `${dia.fecha},${dia.mensajes},${dia.pedidos},${dia.ventas}\n`;
  }
  
  csv += '\nTop Productos\n';
  csv += 'Producto,Unidades,Ingresos\n';
  
  for (const producto of reporte.top_productos) {
    csv += `${producto.nombre},${producto.unidades},${producto.ingresos}\n`;
  }
  
  return csv;
}

module.exports = reportWorker;
