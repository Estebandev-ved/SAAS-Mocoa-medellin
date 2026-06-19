const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { verificarAuth } = require('../middleware/auth');

function obtenerPool() {
    return mysql.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'antigravity',
        waitForConnections: true,
        connectionLimit: 10
    });
}

router.use(verificarAuth);

router.get('/', async (req, res) => {
    try {
        const db = obtenerPool();
        const { activo, buscar, page = 1, limit = 50 } = req.query;
        
        let whereClause = 'WHERE negocio_id = ?';
        const params = [req.negocio.id];
        
        if (activo !== undefined) {
            whereClause += ' AND activo = ?';
            params.push(activo === 'true');
        }
        
        if (buscar) {
            whereClause += ' AND (nombre LIKE ? OR descripcion LIKE ?)';
            params.push(`%${buscar}%`, `%${buscar}%`);
        }
        
        const offset = (page - 1) * limit;
        
        const [productos] = await db.execute(
            `SELECT * FROM productos ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        
        res.json({ success: true, data: productos });
        
    } catch (error) {
        console.error('[Products] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const db = obtenerPool();
        const { id } = req.params;
        
        const [productos] = await db.execute(
            'SELECT * FROM productos WHERE id = ? AND negocio_id = ?',
            [id, req.negocio.id]
        );
        
        if (productos.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        res.json({ success: true, data: productos[0] });
        
    } catch (error) {
        console.error('[Products] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener producto' });
    }
});

router.post('/', async (req, res) => {
    try {
        const db = obtenerPool();
        const { nombre, descripcion, precio, stock, activo, imagen_url } = req.body;
        
        if (!nombre || !precio) {
            return res.status(400).json({ error: 'Nombre y precio son requeridos' });
        }
        
        const [result] = await db.execute(
            `INSERT INTO productos (negocio_id, nombre, descripcion, precio, stock, activo, imagen_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                req.negocio.id,
                nombre,
                descripcion || null,
                precio,
                stock || 0,
                activo !== false,
                imagen_url || null
            ]
        );
        
        const [nuevoProducto] = await db.execute(
            'SELECT * FROM productos WHERE id = ?',
            [result.insertId]
        );
        
        console.log(`[Products] Producto creado: ${nombre} (ID: ${result.insertId})`);
        
        res.status(201).json({
            success: true,
            message: 'Producto creado correctamente',
            data: nuevoProducto[0]
        });
        
    } catch (error) {
        console.error('[Products] Error:', error.message);
        res.status(500).json({ error: 'Error al crear producto' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const db = obtenerPool();
        const { id } = req.params;
        const { nombre, descripcion, precio, stock, activo, imagen_url } = req.body;
        
        const [existe] = await db.execute(
            'SELECT id FROM productos WHERE id = ? AND negocio_id = ?',
            [id, req.negocio.id]
        );
        
        if (existe.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        const updates = [];
        const params = [];
        
        if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre); }
        if (descripcion !== undefined) { updates.push('descripcion = ?'); params.push(descripcion); }
        if (precio !== undefined) { updates.push('precio = ?'); params.push(precio); }
        if (stock !== undefined) { updates.push('stock = ?'); params.push(stock); }
        if (activo !== undefined) { updates.push('activo = ?'); params.push(activo); }
        if (imagen_url !== undefined) { updates.push('imagen_url = ?'); params.push(imagen_url); }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }
        
        params.push(id);
        
        await db.execute(
            `UPDATE productos SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
        
        const [productoActualizado] = await db.execute(
            'SELECT * FROM productos WHERE id = ?',
            [id]
        );
        
        res.json({
            success: true,
            message: 'Producto actualizado correctamente',
            data: productoActualizado[0]
        });
        
    } catch (error) {
        console.error('[Products] Error:', error.message);
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
});

router.patch('/:id/stock', async (req, res) => {
    try {
        const db = obtenerPool();
        const { id } = req.params;
        const { operacion, cantidad } = req.body;
        
        if (!operacion || !cantidad) {
            return res.status(400).json({ error: 'Operación y cantidad son requeridos' });
        }
        
        if (!['agregar', 'restar'].includes(operacion)) {
            return res.status(400).json({ error: 'Operación debe ser agregar o restar' });
        }
        
        const [producto] = await db.execute(
            'SELECT * FROM productos WHERE id = ? AND negocio_id = ?',
            [id, req.negocio.id]
        );
        
        if (producto.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        let nuevoStock;
        if (operacion === 'agregar') {
            nuevoStock = producto[0].stock + cantidad;
        } else {
            nuevoStock = producto[0].stock - cantidad;
            if (nuevoStock < 0) {
                return res.status(400).json({ 
                    error: 'Stock insuficiente',
                    stock_actual: producto[0].stock,
                    cantidad_solicitada: cantidad
                });
            }
        }
        
        await db.execute(
            'UPDATE productos SET stock = ? WHERE id = ?',
            [nuevoStock, id]
        );
        
        res.json({
            success: true,
            message: `Stock ${operacion === 'agregar' ? 'aumentado' : 'disminuido'} correctamente`,
            stock_anterior: producto[0].stock,
            stock_nuevo: nuevoStock
        });
        
    } catch (error) {
        console.error('[Products] Error:', error.message);
        res.status(500).json({ error: 'Error al actualizar stock' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const db = obtenerPool();
        const { id } = req.params;
        
        const [producto] = await db.execute(
            'SELECT id FROM productos WHERE id = ? AND negocio_id = ?',
            [id, req.negocio.id]
        );
        
        if (producto.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        await db.execute(
            'UPDATE productos SET activo = 0 WHERE id = ?',
            [id]
        );
        
        res.json({ success: true, message: 'Producto eliminado correctamente' });
        
    } catch (error) {
        console.error('[Products] Error:', error.message);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
});

module.exports = router;
