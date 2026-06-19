const db = require('../config');

const clientsQueries = {
  getClientsByNegocio(negocioId, filtros = {}) {
    let query = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM pedidos p WHERE p.cliente_id = c.id AND p.negocio_id = c.negocio_id) as pedidos_count
      FROM clientes c
      WHERE c.negocio_id = ?
    `;
    const params = [negocioId];

    if (filtros.busqueda) {
      query += ' AND (c.nombre LIKE ? OR c.whatsapp LIKE ?)';
      const searchTerm = `%${filtros.busqueda}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY c.created_at DESC';

    if (filtros.limit) {
      query += ' LIMIT ?';
      params.push(filtros.limit);
    }

    return db.execute(query, params);
  },

  getClientById(negocioId, clienteId) {
    return db.execute(
      `SELECT * FROM clientes WHERE id = ? AND negocio_id = ?`,
      [clienteId, negocioId]
    );
  },

  getClientByWhatsapp(negocioId, whatsapp) {
    const normalizedWhatsapp = whatsapp.replace(/\D/g, '');
    return db.execute(
      `SELECT * FROM clientes WHERE negocio_id = ? AND REPLACE(REPLACE(whatsapp, '+', ''), ' ', '') LIKE ?`,
      [negocioId, `%${normalizedWhatsapp}`]
    );
  },

  createClient(negocioId, data) {
    const { nombre, whatsapp } = data;
    return db.execute(
      `INSERT INTO clientes (negocio_id, nombre, whatsapp) VALUES (?, ?, ?)`,
      [negocioId, nombre, whatsapp]
    );
  },

  updateClient(negocioId, clienteId, data) {
    const fields = [];
    const values = [];

    if (data.nombre !== undefined) {
      fields.push('nombre = ?');
      values.push(data.nombre);
    }
    if (data.whatsapp !== undefined) {
      fields.push('whatsapp = ?');
      values.push(data.whatsapp);
    }

    if (fields.length === 0) return Promise.resolve([{ affectedRows: 0 }]);

    values.push(clienteId, negocioId);
    return db.execute(
      `UPDATE clientes SET ${fields.join(', ')} WHERE id = ? AND negocio_id = ?`,
      values
    );
  },

  updateClientStats(negocioId, clienteId) {
    return db.execute(
      `UPDATE clientes SET 
        total_pedidos = (SELECT COUNT(*) FROM pedidos WHERE cliente_id = ? AND negocio_id = ?),
        total_gastado = (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE cliente_id = ? AND negocio_id = ? AND estado IN ('pago_confirmado', 'en_preparacion', 'enviado', 'entregado')),
        ultimo_pedido = (SELECT MAX(created_at) FROM pedidos WHERE cliente_id = ? AND negocio_id = ?)
      WHERE id = ? AND negocio_id = ?`,
      [clienteId, negocioId, clienteId, negocioId, clienteId, negocioId, clienteId, negocioId]
    );
  },

  getClientesInactivos(negocioId, diasInactivo = 30) {
    return db.execute(
      `SELECT c.*, DATEDIFF(NOW(), c.ultimo_pedido) as dias_inactivo
       FROM clientes c
       WHERE c.negocio_id = ?
       AND c.ultimo_pedido IS NOT NULL
       AND DATEDIFF(NOW(), c.ultimo_pedido) > ?
       ORDER BY dias_inactivo DESC`,
      [negocioId, diasInactivo]
    );
  },

  getClientesPorSegmento(negocioId, segmento, config = {}) {
    let query = 'SELECT * FROM clientes WHERE negocio_id = ?';
    const params = [negocioId];

    switch (segmento) {
      case 'inactivos':
        query += ' AND ultimo_pedido IS NOT NULL';
        if (config.dias) {
          query += ' AND DATEDIFF(NOW(), ultimo_pedido) > ?';
          params.push(config.dias);
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
    }

    return db.execute(query, params);
  },

  getStatsClientes(negocioId) {
    return db.execute(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN ultimo_pedido >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as activos_30_dias,
        SUM(CASE WHEN total_pedidos >= 5 THEN 1 ELSE 0 END) as recurrentes,
        SUM(total_gastado) as valor_total
      FROM clientes WHERE negocio_id = ?`,
      [negocioId]
    );
  },

  deleteClient(negocioId, clienteId) {
    return db.execute(
      `DELETE FROM clientes WHERE id = ? AND negocio_id = ?`,
      [clienteId, negocioId]
    );
  }
};

module.exports = clientsQueries;
