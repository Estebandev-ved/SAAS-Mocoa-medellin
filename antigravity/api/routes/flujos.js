const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const F = require('../services/flujos');

// Constructor de flujos (docs/constructor-de-flujos.md). Todo filtrado por negocio_id.
// Guardar siempre valida la estructura; encender (activo = true) además exige que el flujo esté completo.
router.use(verificarAuth);

function aFlujo(fila) {
    const definicion = typeof fila.definicion === 'string' ? JSON.parse(fila.definicion) : fila.definicion;
    return {
        id: fila.id, nombre: fila.nombre, activo: !!fila.activo, version: fila.version,
        definicion, updated_at: fila.updated_at, created_at: fila.created_at,
    };
}

async function contarFlujos(negocioId) {
    const [r] = await db.execute('SELECT COUNT(*) AS total FROM flujos WHERE negocio_id = ?', [negocioId]);
    return r[0].total;
}

router.get('/', async (req, res) => {
    try {
        const [filas] = await db.execute(
            'SELECT id, nombre, activo, definicion, version, created_at, updated_at FROM flujos WHERE negocio_id = ? ORDER BY updated_at DESC',
            [req.negocioId]
        );
        const limite = F.limiteDeFlujos(req.negocio.plan);
        res.json({ flujos: filas.map(aFlujo), limite: Number.isFinite(limite) ? limite : null });
    } catch (error) {
        console.error('[Flujos] Error listando:', error.message);
        res.status(500).json({ error: 'Error al obtener los flujos' });
    }
});

// Lee, valida y devuelve { nombre, definicion, activo } listos para guardar, o responde el error.
function leerCuerpo(req, res) {
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim().slice(0, 100) : '';
    if (!nombre) { res.status(400).json({ error: 'Ponle un nombre al flujo' }); return null; }
    const { definicion, error } = F.validarDefinicion(req.body?.definicion);
    if (error) { res.status(400).json({ error }); return null; }
    let activo = req.body?.activo === true;
    if (activo) {
        const motivo = F.validarParaActivar(definicion);
        if (motivo) { res.status(400).json({ error: motivo, codigo: 'FLUJO_INCOMPLETO' }); return null; }
    }
    return { nombre, definicion, activo };
}

router.post('/', async (req, res) => {
    try {
        const datos = leerCuerpo(req, res);
        if (!datos) return;
        const limite = F.limiteDeFlujos(req.negocio.plan);
        if ((await contarFlujos(req.negocioId)) >= limite) {
            return res.status(403).json({ error: `Tu plan permite hasta ${limite} flujos. Mejora tu plan para crear más.`, codigo: 'LIMITE_FLUJOS', limite });
        }
        const { palabraClave, primerMensaje } = F.datosDisparador(datos.definicion);
        const [r] = await db.execute(
            'INSERT INTO flujos (negocio_id, nombre, activo, definicion, palabra_clave, primer_mensaje) VALUES (?, ?, ?, ?, ?, ?)',
            [req.negocioId, datos.nombre, datos.activo, JSON.stringify(datos.definicion), palabraClave, primerMensaje]
        );
        res.status(201).json({ success: true, id: r.insertId });
    } catch (error) {
        console.error('[Flujos] Error creando:', error.message);
        res.status(500).json({ error: 'Error al crear el flujo' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const datos = leerCuerpo(req, res);
        if (!datos) return;
        const { palabraClave, primerMensaje } = F.datosDisparador(datos.definicion);
        const [r] = await db.execute(
            `UPDATE flujos SET nombre = ?, activo = ?, definicion = ?, palabra_clave = ?, primer_mensaje = ?, version = version + 1
             WHERE id = ? AND negocio_id = ?`,
            [datos.nombre, datos.activo, JSON.stringify(datos.definicion), palabraClave, primerMensaje, req.params.id, req.negocioId]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Flujo no encontrado' });
        res.json({ success: true });
    } catch (error) {
        console.error('[Flujos] Error guardando:', error.message);
        res.status(500).json({ error: 'Error al guardar el flujo' });
    }
});

// Enciende o apaga sin tocar el contenido.
router.patch('/:id/activo', async (req, res) => {
    try {
        const activo = req.body?.activo === true;
        if (activo) {
            const [filas] = await db.execute('SELECT definicion FROM flujos WHERE id = ? AND negocio_id = ?', [req.params.id, req.negocioId]);
            if (filas.length === 0) return res.status(404).json({ error: 'Flujo no encontrado' });
            const def = typeof filas[0].definicion === 'string' ? JSON.parse(filas[0].definicion) : filas[0].definicion;
            const motivo = F.validarParaActivar(def);
            if (motivo) return res.status(400).json({ error: motivo, codigo: 'FLUJO_INCOMPLETO' });
        }
        const [r] = await db.execute('UPDATE flujos SET activo = ? WHERE id = ? AND negocio_id = ?', [activo, req.params.id, req.negocioId]);
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Flujo no encontrado' });
        res.json({ success: true, activo });
    } catch (error) {
        console.error('[Flujos] Error cambiando estado:', error.message);
        res.status(500).json({ error: 'Error al cambiar el estado del flujo' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const [r] = await db.execute('DELETE FROM flujos WHERE id = ? AND negocio_id = ?', [req.params.id, req.negocioId]);
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Flujo no encontrado' });
        res.json({ success: true });
    } catch (error) {
        console.error('[Flujos] Error borrando:', error.message);
        res.status(500).json({ error: 'Error al borrar el flujo' });
    }
});

module.exports = router;
