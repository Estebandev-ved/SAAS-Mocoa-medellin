const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

router.use(verificarAuth);

router.get('/', async (req, res) => {
    try {
        const [clientes] = await db.execute(
            `SELECT c.*, 
                    (SELECT COUNT(*) FROM pedidos p WHERE p.cliente_id = c.id AND p.negocio_id = c.negocio_id) as total_pedidos,
                    (SELECT COALESCE(SUM(p.total), 0) FROM pedidos p WHERE p.cliente_id = c.id AND p.negocio_id = c.negocio_id AND p.estado IN ('entregado','pago_confirmado')) as total_gastado,
                    (SELECT MAX(p.created_at) FROM pedidos p WHERE p.cliente_id = c.id AND p.negocio_id = c.negocio_id) as ultimo_pedido
             FROM clientes c
             WHERE c.negocio_id = ?
             ORDER BY c.created_at DESC`,
            [req.negocioId]
        );

        res.json({
            clientes: clientes.map(c => ({
                ...c,
                es_comprador: (c.total_pedidos || 0) > 0
            })),
            total: clientes.length
        });
    } catch (error) {
        console.error('[Clientes] Error:', error);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const [clientes] = await db.execute(
            'SELECT * FROM clientes WHERE id = ? AND negocio_id = ?',
            [req.params.id, req.negocioId]
        );
        if (clientes.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json(clientes[0]);
    } catch (error) {
        console.error('[Clientes] Error:', error);
        res.status(500).json({ error: 'Error al obtener cliente' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { nombre, whatsapp } = req.body;
        await db.execute(
            'UPDATE clientes SET nombre = ?, whatsapp = ? WHERE id = ? AND negocio_id = ?',
            [nombre, whatsapp, req.params.id, req.negocioId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('[Clientes] Error:', error);
        res.status(500).json({ error: 'Error al actualizar cliente' });
    }
});

module.exports = router;
