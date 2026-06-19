const db = require('../config');

const productsQueries = {
  getProductsByNegocio(negocioId, filtros = {}) {
    let query = 'SELECT * FROM productos WHERE negocio_id = ?';
    const params = [negocioId];

    if (filtros.activo !== undefined) {
      query += ' AND activo = ?';
      params.push(filtros.activo);
    }

    if (filtros.busqueda) {
      query += ' AND (nombre LIKE ? OR descripcion LIKE ?)';
      const searchTerm = `%${filtros.busqueda}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY created_at DESC';

    if (filtros.limit) {
      query += ' LIMIT ?';
      params.push(filtros.limit);
    }

    return db.execute(query, params);
  },

  getProductById(negocioId, productoId) {
    return db.execute(
      `SELECT * FROM productos WHERE id = ? AND negocio_id = ?`,
      [productoId, negocioId]
    );
  },

  getActiveProducts(negocioId) {
    return db.execute(
      `SELECT * FROM productos WHERE negocio_id = ? AND activo = true ORDER BY nombre`,
      [negocioId]
    );
  },

  createProduct(negocioId, data) {
    const { nombre, descripcion, precio, stock, activo, imagen_url } = data;
    return db.execute(
      `INSERT INTO productos (negocio_id, nombre, descripcion, precio, stock, activo, imagen_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [negocioId, nombre, descripcion || null, precio, stock || 0, activo !== false, imagen_url || null]
    );
  },

  updateProduct(negocioId, productoId, data) {
    const fields = [];
    const values = [];

    if (data.nombre !== undefined) {
      fields.push('nombre = ?');
      values.push(data.nombre);
    }
    if (data.descripcion !== undefined) {
      fields.push('descripcion = ?');
      values.push(data.descripcion);
    }
    if (data.precio !== undefined) {
      fields.push('precio = ?');
      values.push(data.precio);
    }
    if (data.stock !== undefined) {
      fields.push('stock = ?');
      values.push(data.stock);
    }
    if (data.activo !== undefined) {
      fields.push('activo = ?');
      values.push(data.activo);
    }
    if (data.imagen_url !== undefined) {
      fields.push('imagen_url = ?');
      values.push(data.imagen_url);
    }

    if (fields.length === 0) return Promise.resolve([{ affectedRows: 0 }]);

    values.push(productoId, negocioId);
    return db.execute(
      `UPDATE productos SET ${fields.join(', ')} WHERE id = ? AND negocio_id = ?`,
      values
    );
  },

  updateStock(negocioId, productoId, cantidad) {
    return db.execute(
      `UPDATE productos SET stock = stock - ? WHERE id = ? AND negocio_id = ? AND stock >= ?`,
      [cantidad, productoId, negocioId, cantidad]
    );
  },

  restoreStock(negocioId, productoId, cantidad) {
    return db.execute(
      `UPDATE productos SET stock = stock + ? WHERE id = ? AND negocio_id = ?`,
      [cantidad, productoId, negocioId]
    );
  },

  getLowStockProducts(negocioId, umbral = 5) {
    return db.execute(
      `SELECT * FROM productos 
       WHERE negocio_id = ? AND activo = true AND stock <= ?
       ORDER BY stock ASC`,
      [negocioId, umbral]
    );
  },

  getStatsProductos(negocioId) {
    return db.execute(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN activo = true THEN 1 ELSE 0 END) as activos,
        SUM(CASE WHEN stock <= 5 THEN 1 ELSE 0 END) as stock_bajo,
        SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as sin_stock,
        AVG(precio) as precio_promedio
      FROM productos WHERE negocio_id = ?`,
      [negocioId]
    );
  },

  getTopSellingProducts(negocioId, limit = 5) {
    return db.execute(
      `SELECT p.*, SUM(ip.cantidad) as unidades_vendidas, SUM(ip.subtotal) as ingresos
       FROM productos p
       LEFT JOIN items_pedido ip ON p.id = ip.producto_id
       LEFT JOIN pedidos ped ON ip.pedido_id = ped.id AND ped.negocio_id = ?
       WHERE p.negocio_id = ?
       GROUP BY p.id
       ORDER BY ingresos DESC
       LIMIT ?`,
      [negocioId, negocioId, limit]
    );
  },

  searchProducts(negocioId, searchTerm) {
    return db.execute(
      `SELECT * FROM productos 
       WHERE negocio_id = ? AND activo = true 
       AND (nombre LIKE ? OR descripcion LIKE ?)
       ORDER BY nombre
       LIMIT 20`,
      [negocioId, `%${searchTerm}%`, `%${searchTerm}%`]
    );
  },

  deleteProduct(negocioId, productoId) {
    return db.execute(
      `DELETE FROM productos WHERE id = ? AND negocio_id = ?`,
      [productoId, negocioId]
    );
  },

  getProductPrices(negocioId) {
    return db.execute(
      `SELECT id, nombre, precio FROM productos 
       WHERE negocio_id = ? AND activo = true 
       ORDER BY nombre`,
      [negocioId]
    );
  }
};

module.exports = productsQueries;
