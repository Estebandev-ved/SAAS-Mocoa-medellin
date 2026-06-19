const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { verificarAuth } = require('../middleware/auth');
const { emitirEstadoCambiado, emitirNuevoPedido } = require('../../bot/services/socket');

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

const TRANSICIONES_VALIDAS = {
    'pendiente_pago': ['pago_enviado', 'cancelado'],
    'pago_enviado': ['pago_confirmado', 'cancelado'],
    'pago_confirmado': ['en_preparacion', 'cancelado'],
    'en_preparacion': ['enviado', 'cancelado'],
    'enviado': ['entregado', 'cancelado'],
    'entregado': [],
    'cancelado': []
};

router.use(verificarAuth);

router.get('/', async (req, res) => {
    try {
        const db = obtenerPool();
        const { estado, fecha_desde, fecha_hasta, cliente, page = 1, limit = 20 } = req.query;
        
        let whereClause = 'WHERE p.negocio_id = ?';
        const params = [req.negocio.id];
        
        if (estado) {
            whereClause += ' AND p.estado = ?';
            params.push(estado);
        }
        
        if (fecha_desde) {
            whereClause += ' AND DATE(p.created_at) >= ?';
            params.push(fecha_desde);
        }
        
        if (fecha_hasta) {
            whereClause += ' AND DATE(p.created_at) <= ?';
            params.push(fecha_hasta);
        }
        
        if (cliente) {
            whereClause += ' AND c.nombre LIKE ?';
            params.push(`%${cliente}%`);
        }
        
        const offset = (page - 1) * limit;
        
        const [countResult] = await db.execute(
            `SELECT COUNT(*) as total FROM pedidos p 
             JOIN clientes c ON p.cliente_id = c.id 
             ${whereClause}`,
            params
        );
        
        const [pedidos] = await db.execute(
            `SELECT p.*, c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp
             FROM pedidos p
             JOIN clientes c ON p.cliente_id = c.id
             ${whereClause}
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        
        for (const pedido of pedidos) {
            const [items] = await db.execute(
                `SELECT ip.*, pr.nombre as producto_nombre, pr.imagen_url 
                 FROM items_pedido ip 
                 JOIN productos pr ON ip.producto_id = pr.id 
                 WHERE ip.pedido_id = ?`,
                [pedido.id]
            );
            pedido.items = items;
        }
        
        res.json({
            success: true,
            data: pedidos,
            paginacion: {
                pagina: parseInt(page),
                limite: parseInt(limit),
                total: countResult[0].total,
                paginas: Math.ceil(countResult[0].total / limit)
            }
        });
        
    } catch (error) {
        console.error('[Orders] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const db = obtenerPool();
        const { id } = req.params;
        
        const [pedidos] = await db.execute(
            `SELECT p.*, c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp, c.email as cliente_email
             FROM pedidos p
             JOIN clientes c ON p.cliente_id = c.id
             WHERE p.id = ? AND p.negocio_id = ?`,
            [id, req.negocio.id]
        );
        
        if (pedidos.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        
        const pedido = pedidos[0];
        
        const [items] = await db.execute(
            `SELECT ip.*, pr.nombre as producto_nombre, pr.imagen_url, pr.descripcion as producto_descripcion
             FROM items_pedido ip
             JOIN productos pr ON ip.producto_id = pr.id
             WHERE ip.pedido_id = ?`,
            [id]
        );
        pedido.items = items;
        
        const [conversacion] = await db.execute(
            `SELECT id, mensajes FROM conversaciones 
             WHERE pedido_id = ? AND cliente_id = ?`,
            [id, pedido.cliente_id]
        );
        if (conversacion.length > 0) {
            pedido.conversacion = {
                id: conversacion[0].id,
                mensajes: JSON.parse(conversacion[0].mensajes || '[]')
            };
        }
        
        res.json({ success: true, data: pedido });
        
    } catch (error) {
        console.error('[Orders] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener pedido' });
    }
});

router.patch('/:id/estado', async (req, res) => {
    try {
        const db = obtenerPool();
        const { id } = req.params;
        const { estado: nuevoEstado } = req.body;
        
        if (!nuevoEstado) {
            return res.status(400).json({ error: 'El estado es requerido' });
        }
        
        const [pedidos] = await db.execute(
            'SELECT * FROM pedidos WHERE id = ? AND negocio_id = ?',
            [id, req.negocio.id]
        );
        
        if (pedidos.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        
        const pedidoActual = pedidos[0];
        const estadoActual = pedidoActual.estado;
        
        const transicionesPermitidas = TRANSICIONES_VALIDAS[estadoActual] || [];
        
        if (!transicionesPermitidas.includes(nuevoEstado)) {
            return res.status(400).json({
                error: `No se puede cambiar de '${estadoActual}' a '${nuevoEstado}'`,
                transiciones_permitidas: transicionesPermitidas
            });
        }
        
        await db.execute(
            'UPDATE pedidos SET estado = ?, updated_at = NOW() WHERE id = ?',
            [nuevoEstado, id]
        );
        
        if (nuevoEstado === 'entregado') {
            await db.execute(
                `UPDATE clientes SET 
                 total_pedidos = total_pedidos + 1,
                 total_gastado = total_gastado + ?,
                 ultimo_pedido = NOW()
                 WHERE id = ?`,
                [pedidoActual.total, pedidoActual.cliente_id]
            );
        }
        
        const [pedidoActualizado] = await db.execute(
            `SELECT p.*, c.nombre as cliente_nombre 
             FROM pedidos p 
             JOIN clientes c ON p.cliente_id = c.id 
             WHERE p.id = ?`,
            [id]
        );
        
        emitirEstadoCambiado(id, nuevoEstado, req.negocio.id, pedidoActualizado[0]);
        
        res.json({
            success: true,
            message: `Estado actualizado a ${nuevoEstado}`,
            data: pedidoActualizado[0]
        });
        
    } catch (error) {
        console.error('[Orders] Error:', error.message);
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const db = obtenerPool();
        const { id } = req.params;
        
        const [pedidos] = await db.execute(
            'SELECT * FROM pedidos WHERE id = ? AND negocio_id = ?',
            [id, req.negocio.id]
        );
        
        if (pedidos.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        
        if (pedidos[0].estado === 'cancelado') {
            return res.status(400).json({ error: 'El pedido ya está cancelado' });
        }
        
        await db.execute(
            'UPDATE pedidos SET estado = ?, updated_at = NOW() WHERE id = ?',
            ['cancelado', id]
        );
        
        for (const item of pedidos[0].items || []) {
            await db.execute(
                'UPDATE productos SET stock = stock + ? WHERE id = ?',
                [item.cantidad, item.producto_id]
            );
        }
        
        emitirEstadoCambiado(id, 'cancelado', req.negocio.id);
        
        res.json({ success: true, message: 'Pedido cancelado correctamente' });
        
    } catch (error) {
        console.error('[Orders] Error:', error.message);
        res.status(500).json({ error: 'Error al cancelar pedido' });
    }
});

router.post('/exportar', async (req, res) => {
    try {
        const db = obtenerPool();
        const { fecha_desde, fecha_hasta, formato = 'csv' } = req.body;
        
        let whereClause = 'WHERE p.negocio_id = ?';
        const params = [req.negocio.id];
        
        if (fecha_desde) {
            whereClause += ' AND DATE(p.created_at) >= ?';
            params.push(fecha_desde);
        }
        
        if (fecha_hasta) {
            whereClause += ' AND DATE(p.created_at) <= ?';
            params.push(fecha_hasta);
        }
        
        const [pedidos] = await db.execute(
            `SELECT p.numero_pedido, p.estado, p.total, p.metodo_pago, 
                    p.direccion_entrega, p.created_at, c.nombre as cliente, c.whatsapp
             FROM pedidos p
             JOIN clientes c ON p.cliente_id = c.id
             ${whereClause}
             ORDER BY p.created_at DESC`,
            params
        );
        
        if (formato === 'csv') {
            const headers = ['Numero Pedido', 'Estado', 'Total', 'Metodo Pago', 'Direccion', 'Fecha', 'Cliente', 'WhatsApp'];
            const rows = pedidos.map(p => [
                p.numero_pedido,
                p.estado,
                p.total,
                p.metodo_pago || '',
                p.direccion_entrega || '',
                p.created_at,
                p.cliente,
                p.whatsapp
            ]);
            
            const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=pedidos.csv');
            return res.send(csv);
        }
        
        res.json({ success: true, data: pedidos, total: pedidos.length });
        
    } catch (error) {
        console.error('[Orders] Error:', error.message);
        res.status(500).json({ error: 'Error al exportar pedidos' });
    }
});

module.exports = router;
