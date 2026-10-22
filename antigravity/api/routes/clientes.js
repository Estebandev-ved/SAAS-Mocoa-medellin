const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { sanearNuevoCliente } = require('../services/clientes');
const { normalizarEtiqueta } = require('../services/flujos');

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

        // Etiquetas puestas por los flujos. Si la tabla aún no existe (migración pendiente) la lista sigue funcionando.
        const porCliente = new Map();
        try {
            const [tags] = await db.execute('SELECT cliente_id, etiqueta FROM etiquetas_cliente WHERE negocio_id = ? ORDER BY etiqueta', [req.negocioId]);
            for (const t of tags) porCliente.set(t.cliente_id, [...(porCliente.get(t.cliente_id) || []), t.etiqueta]);
        } catch (e) { /* sin etiquetas */ }

        res.json({
            clientes: clientes.map(c => ({
                ...c,
                es_comprador: (c.total_pedidos || 0) > 0,
                etiquetas: porCliente.get(c.id) || []
            })),
            total: clientes.length
        });
    } catch (error) {
        console.error('[Clientes] Error:', error);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

// Alta manual de un cliente. Queda sin consentimiento de marketing y con el onboarding pendiente:
// cuando escriba por primera vez, el bot le pide nombre, correo y autorización (Ley 1581).
router.post('/', async (req, res) => {
    try {
        const { valores, error } = sanearNuevoCliente(req.body);
        if (error) return res.status(400).json({ error });
        const [r] = await db.execute(
            'INSERT INTO clientes (negocio_id, nombre, whatsapp, email) VALUES (?, ?, ?, ?)',
            [req.negocioId, valores.nombre, valores.whatsapp, valores.email]
        );
        res.status(201).json({ success: true, id: r.insertId, cliente: { id: r.insertId, ...valores, total_pedidos: 0, total_gastado: 0, etiquetas: [] } });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya tienes un cliente con ese WhatsApp' });
        console.error('[Clientes] Error creando:', error.message);
        res.status(500).json({ error: 'Error al crear el cliente' });
    }
});

// Etiquetas de un cliente (las ponen los flujos, y el dueño puede ponerlas o quitarlas a mano).
router.post('/:id/etiquetas', async (req, res) => {
    try {
        const etiqueta = normalizarEtiqueta(req.body?.etiqueta);
        if (!etiqueta) return res.status(400).json({ error: 'Escribe una etiqueta (letras o números)' });
        const [c] = await db.execute('SELECT id FROM clientes WHERE id = ? AND negocio_id = ?', [req.params.id, req.negocioId]);
        if (c.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
        const [n] = await db.execute('SELECT COUNT(*) AS total FROM etiquetas_cliente WHERE negocio_id = ? AND cliente_id = ?', [req.negocioId, req.params.id]);
        if (n[0].total >= 20) return res.status(400).json({ error: 'Un cliente puede tener hasta 20 etiquetas' });
        await db.execute('INSERT IGNORE INTO etiquetas_cliente (negocio_id, cliente_id, etiqueta) VALUES (?, ?, ?)', [req.negocioId, req.params.id, etiqueta]);
        res.status(201).json({ success: true, etiqueta });
    } catch (error) {
        console.error('[Clientes] Error poniendo etiqueta:', error.message);
        res.status(500).json({ error: 'Error al poner la etiqueta' });
    }
});

router.delete('/:id/etiquetas/:etiqueta', async (req, res) => {
    try {
        const [r] = await db.execute(
            'DELETE FROM etiquetas_cliente WHERE negocio_id = ? AND cliente_id = ? AND etiqueta = ?',
            [req.negocioId, req.params.id, normalizarEtiqueta(req.params.etiqueta)]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Etiqueta no encontrada' });
        res.json({ success: true });
    } catch (error) {
        console.error('[Clientes] Error quitando etiqueta:', error.message);
        res.status(500).json({ error: 'Error al quitar la etiqueta' });
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
