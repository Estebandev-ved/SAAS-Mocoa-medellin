const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

// Restaurantes dentro de una empresa de domicilios (db/migrate_marketplace.js).
// El negocio "es" una empresa de domicilios simplemente por tener filas acá —
// no hay una bandera aparte que activar. Un negocio de un solo local nunca
// necesita tocar esta ruta y sigue funcionando exactamente igual que antes.
router.use(verificarAuth);

router.get('/', async (req, res) => {
    try {
        const [restaurantes] = await db.execute(
            `SELECT r.*, COUNT(p.id) as total_productos
             FROM restaurantes r
             LEFT JOIN productos p ON p.restaurante_id = r.id AND p.activo = 1
             WHERE r.negocio_id = ? AND r.activo = 1
             GROUP BY r.id
             ORDER BY r.nombre`,
            [req.negocioId]
        );
        res.json({ restaurantes });
    } catch (error) {
        console.error('[Restaurantes] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener restaurantes' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const [restaurantes] = await db.execute(
            'SELECT * FROM restaurantes WHERE id = ? AND negocio_id = ?',
            [req.params.id, req.negocioId]
        );
        if (restaurantes.length === 0) {
            return res.status(404).json({ error: 'Restaurante no encontrado' });
        }
        res.json({ restaurante: restaurantes[0] });
    } catch (error) {
        console.error('[Restaurantes] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener restaurante' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { nombre, descripcion, categoria, direccion, ciudad, logo_url } = req.body;
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const [result] = await db.execute(
            `INSERT INTO restaurantes (negocio_id, nombre, descripcion, categoria, direccion, ciudad, logo_url)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.negocioId, nombre.trim(), descripcion || null, categoria || null, direccion || null, ciudad || null, logo_url || null]
        );

        const [nuevo] = await db.execute('SELECT * FROM restaurantes WHERE id = ?', [result.insertId]);
        res.status(201).json({ mensaje: 'Restaurante creado', restaurante: nuevo[0] });
    } catch (error) {
        console.error('[Restaurantes] Error creando:', error.message);
        res.status(500).json({ error: 'Error al crear restaurante' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { nombre, descripcion, categoria, direccion, ciudad, logo_url, activo } = req.body;
        const updates = [];
        const params = [];

        if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre); }
        if (descripcion !== undefined) { updates.push('descripcion = ?'); params.push(descripcion || null); }
        if (categoria !== undefined) { updates.push('categoria = ?'); params.push(categoria || null); }
        if (direccion !== undefined) { updates.push('direccion = ?'); params.push(direccion || null); }
        if (ciudad !== undefined) { updates.push('ciudad = ?'); params.push(ciudad || null); }
        if (logo_url !== undefined) { updates.push('logo_url = ?'); params.push(logo_url || null); }
        if (activo !== undefined) { updates.push('activo = ?'); params.push(!!activo); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        // Si cambió la dirección/ciudad, la ubicación cacheada queda obsoleta —
        // mismo caso que ya se corrigió en negocios (PUT /business/perfil).
        if (updates.some((u) => u.startsWith('direccion') || u.startsWith('ciudad'))) {
            updates.push('lat = NULL', 'lng = NULL');
        }

        params.push(req.params.id, req.negocioId);

        const [result] = await db.execute(
            `UPDATE restaurantes SET ${updates.join(', ')} WHERE id = ? AND negocio_id = ?`,
            params
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Restaurante no encontrado' });
        }

        const [actualizado] = await db.execute('SELECT * FROM restaurantes WHERE id = ?', [req.params.id]);
        res.json({ mensaje: 'Restaurante actualizado', restaurante: actualizado[0] });
    } catch (error) {
        console.error('[Restaurantes] Error actualizando:', error.message);
        res.status(500).json({ error: 'Error al actualizar restaurante' });
    }
});

// Soft delete, igual que productos: no se borran pedidos/domicilios históricos
// que quedaron amarrados a este restaurante.
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await db.execute(
            'UPDATE restaurantes SET activo = 0 WHERE id = ? AND negocio_id = ?',
            [req.params.id, req.negocioId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Restaurante no encontrado' });
        }
        res.json({ mensaje: 'Restaurante eliminado', success: true });
    } catch (error) {
        console.error('[Restaurantes] Error eliminando:', error.message);
        res.status(500).json({ error: 'Error al eliminar restaurante' });
    }
});

module.exports = router;
