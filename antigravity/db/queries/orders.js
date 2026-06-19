const db = require('../config');

const ordersQueries = {
  getOrdersByNegocio(negocioId, filtros = {}) {
    let query = `
      SELECT p.*, c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      WHERE p.negocio_id = ?
    `;
    const params = [negocioId];

    if (filtros.estado) {
      query += ' AND p.estado = ?';
      params.push(filtros.estado);
    }

    if (filtros.fechaInicio && filtros.fechaFin) {
      query += ' AND p.created_at BETWEEN ? AND ?';
      params.push(filtros.fechaInicio, filtros.fechaFin);
    }

    query += ' ORDER BY p.created_at DESC';

    if (filtros.limit) {
      query += ' LIMIT ?';
      params.push(filtros.limit);
    }

    return db.execute(query, params);
  },

  getOrderById(negocioId, orderId) {
    return db.execute(
      `SELECT p.*, c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp
       FROM pedidos p
       JOIN clientes c ON p.cliente_id = c.id
       WHERE p.id = ? AND p.negocio_id = ?`,
      [orderId, negocioId]
    );
  },

  getOrderItems(negocioId, orderId) {
    return db.execute(
      `SELECT ip.*, prod.nombre as producto_nombre, prod.imagen_url
       FROM items_pedido ip
       JOIN pedidos p ON ip.pedido_id = p.id
       JOIN productos prod ON ip.producto_id = prod.id
       WHERE p.id = ? AND p.negocio_id = ?`,
      [orderId, negocioId]
    );
  },

  createOrder(negocioId, data) {
    const { cliente_id, numero_pedido, metodo_pago, subtotal, descuento, total, direccion_entrega, notas } = data;
    return db.execute(
      `INSERT INTO pedidos (negocio_id, cliente_id, numero_pedido, metodo_pago, subtotal, descuento, total, direccion_entrega, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [negocioId, cliente_id, numero_pedido, metodo_pago, subtotal, descuento || 0, total, direccion_entrega, notas]
    );
  },

  addOrderItem(pedidoId, productoId, cantidad, precioUnitario, subtotal) {
    return db.execute(
      `INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
       VALUES (?, ?, ?, ?, ?)`,
      [pedidoId, productoId, cantidad, precioUnitario, subtotal]
    );
  },

  updateOrderStatus(negocioId, orderId, estado) {
    return db.execute(
      `UPDATE pedidos SET estado = ?, updated_at = NOW() WHERE id = ? AND negocio_id = ?`,
      [estado, orderId, negocioId]
    );
  },

  generateOrderNumber(negocioId) {
    const prefix = 'AG';
    const year = new Date().getFullYear();
    return `${prefix}-${negocioId}-${Date.now().toString().slice(-6)}`;
  },

  getPedidosPorEstado(negocioId) {
    return db.execute(
      `SELECT estado, COUNT(*) as total, SUM(total) as valor
       FROM pedidos
       WHERE negocio_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY estado`,
      [negocioId]
    );
  },

  getVentasPorDia(negocioId, dias = 30) {
    return db.execute(
      `SELECT DATE(created_at) as fecha, COUNT(*) as pedidos, SUM(total) as ventas
       FROM pedidos
       WHERE negocio_id = ? AND estado IN ('pago_confirmado', 'en_preparacion', 'enviado', 'entregado')
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at)
       ORDER BY fecha`,
      [negocioId, dias]
    );
  },

  getTopProductos(negocioId, limit = 5) {
    return db.execute(
      `SELECT prod.id, prod.nombre, SUM(ip.cantidad) as ventas_unidades, SUM(ip.subtotal) as ventas_valor
       FROM items_pedido ip
       JOIN pedidos p ON ip.pedido_id = p.id
       JOIN productos prod ON ip.producto_id = prod.id
       WHERE p.negocio_id = ? AND p.estado IN ('pago_confirmado', 'en_preparacion', 'enviado', 'entregado')
       AND p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY prod.id
       ORDER BY ventas_valor DESC
       LIMIT ?`,
      [negocioId, limit]
    );
  },

  deleteOrder(negocioId, orderId) {
    return db.execute(
      `DELETE FROM pedidos WHERE id = ? AND negocio_id = ?`,
      [orderId, negocioId]
    );
  }
};

module.exports = ordersQueries;
