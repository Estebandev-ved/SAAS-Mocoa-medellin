const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { normalizarCodigo } = require('../services/cupones');

// Cupones de descuento del negocio. El bot los aplica solo cuando el cliente
// escribe el código al hacer su pedido (ver instance-manager/agents/orchestrator.js).
router.use(verificarAuth);

router.get('/', async (req, res) => {
    try {
        const [cupones] = await db.execute('SELECT * FROM cupones WHERE negocio_id = ? ORDER BY created_at DESC', [req.negocioId]);
        res.json({ cupones });
    } catch (error) {
        console.error('[Cupones] Error listando:', error.message);
        res.status(500).json({ error: 'Error al obtener cupones' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { codigo, tipo, valor, minimo_compra, usos_max, vence_el } = req.body;
        const cod = normalizarCodigo(codigo);
        if (cod.length < 3 || cod.length > 30) return res.status(400).json({ error: 'El código debe tener entre 3 y 30 letras o números' });
        if (!['porcentaje', 'fijo'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
        const v = Number(valor);
        if (!Number.isFinite(v) || v <= 0) return res.status(400).json({ error: 'El valor debe ser mayor que 0' });
        if (tipo === 'porcentaje' && v > 90) return res.status(400).json({ error: 'El porcentaje máximo es 90%' });
        const min = Math.max(0, Number(minimo_compra) || 0);
        const max = usos_max === '' || usos_max == null ? null : Math.max(1, parseInt(usos_max));
        const vence = vence_el ? String(vence_el).slice(0, 10) : null;
        if (vence && !/^\d{4}-\d{2}-\d{2}$/.test(vence)) return res.status(400).json({ error: 'Fecha inválida' });

        const [r] = await db.execute(
            'INSERT INTO cupones (negocio_id, codigo, tipo, valor, minimo_compra, usos_max, vence_el) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.negocioId, cod, tipo, v, min, max, vence]
        );
        res.status(201).json({ success: true, id: r.insertId, codigo: cod });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya tienes un cupón con ese código' });
        console.error('[Cupones] Error creando:', error.message);
        res.status(500).json({ error: 'Error al crear el cupón' });
    }
});

router.patch('/:id/toggle', async (req, res) => {
    try {
        const [r] = await db.execute('UPDATE cupones SET activo = NOT activo WHERE id = ? AND negocio_id = ?', [req.params.id, req.negocioId]);
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Cupón no encontrado' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar el estado' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const [r] = await db.execute('DELETE FROM cupones WHERE id = ? AND negocio_id = ?', [req.params.id, req.negocioId]);
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Cupón no encontrado' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar el cupón' });
    }
});

module.exports = router;
