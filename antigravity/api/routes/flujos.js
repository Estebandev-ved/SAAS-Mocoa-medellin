const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const F = require('../services/flujos');
const { listarPlantillas } = require('../services/flujosPlantillas');
const { familiaDe } = require('../services/tiposNegocio');
const { HORAS_VIGENCIA_RESPUESTA } = require('../services/flujosEjecucion');
const { simular } = require('../services/flujosSimulador');

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

// Plantillas listas para usar; las recomendadas para el tipo de negocio van primero.
router.get('/plantillas', async (req, res) => {
    try {
        const [n] = await db.execute('SELECT tipo_negocio FROM negocios WHERE id = ?', [req.negocioId]);
        res.json({ plantillas: listarPlantillas(familiaDe(n[0] && n[0].tipo_negocio)) });
    } catch (error) {
        console.error('[Flujos] Error listando plantillas:', error.message);
        res.status(500).json({ error: 'Error al obtener las plantillas' });
    }
});

// Etiquetas que los flujos han puesto a los clientes del negocio, con cuántos clientes tiene cada una.
router.get('/etiquetas', async (req, res) => {
    try {
        const [filas] = await db.execute(
            'SELECT etiqueta, COUNT(*) AS total FROM etiquetas_cliente WHERE negocio_id = ? GROUP BY etiqueta ORDER BY total DESC, etiqueta LIMIT 200',
            [req.negocioId]
        );
        res.json({ etiquetas: filas.map((f) => ({ etiqueta: f.etiqueta, total: Number(f.total) })) });
    } catch (error) {
        console.error('[Flujos] Error listando etiquetas:', error.message);
        res.status(500).json({ error: 'Error al obtener las etiquetas' });
    }
});

// "Probar flujo": corre el motor en memoria con la definición que se está editando (aunque no esté guardada).
// No toca la base de datos ni envía nada por WhatsApp.
router.post('/simular', (req, res) => {
    try {
        const r = simular({ ...req.body, nombre: req.body?.nombre || 'Cliente de prueba' });
        if (r.error) return res.status(400).json({ error: r.error });
        res.json(r);
    } catch (error) {
        console.error('[Flujos] Error simulando:', error.message);
        res.status(500).json({ error: 'No se pudo probar el flujo' });
    }
});

router.post('/', async (req, res) => {
    try {
        const datos = leerCuerpo(req, res);
        if (!datos) return;
        const limite = F.limiteDeFlujos(req.negocio.plan);
        if ((await contarFlujos(req.negocioId)) >= limite) {
            return res.status(403).json({ error: `Tu plan permite hasta ${limite} flujos. Mejora tu plan para crear más.`, codigo: 'LIMITE_FLUJOS', limite });
        }
        const { palabraClave, primerMensaje, evento, eventoDias } = F.datosDisparador(datos.definicion);
        const [r] = await db.execute(
            'INSERT INTO flujos (negocio_id, nombre, activo, definicion, palabra_clave, primer_mensaje, evento, evento_dias) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [req.negocioId, datos.nombre, datos.activo, JSON.stringify(datos.definicion), palabraClave, primerMensaje, evento, eventoDias]
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
        const { palabraClave, primerMensaje, evento, eventoDias } = F.datosDisparador(datos.definicion);
        const [r] = await db.execute(
            `UPDATE flujos SET nombre = ?, activo = ?, definicion = ?, palabra_clave = ?, primer_mensaje = ?, evento = ?, evento_dias = ?, version = version + 1
             WHERE id = ? AND negocio_id = ?`,
            [datos.nombre, datos.activo, JSON.stringify(datos.definicion), palabraClave, primerMensaje, evento, eventoDias, req.params.id, req.negocioId]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Flujo no encontrado' });
        res.json({ success: true });
    } catch (error) {
        console.error('[Flujos] Error guardando:', error.message);
        res.status(500).json({ error: 'Error al guardar el flujo' });
    }
});

// Métricas del flujo (últimos 30 días): cuántos clientes entraron, cuántos terminaron y en qué paso se quedan.
// "Se quedaron" = esperaban una respuesta hace más de HORAS_VIGENCIA_RESPUESTA (ya no la van a dar).
router.get('/:id/metricas', async (req, res) => {
    try {
        const [dueno] = await db.execute('SELECT id FROM flujos WHERE id = ? AND negocio_id = ?', [req.params.id, req.negocioId]);
        if (dueno.length === 0) return res.status(404).json({ error: 'Flujo no encontrado' });

        const [porEstado] = await db.execute(
            `SELECT estado, COUNT(*) AS total FROM flujo_ejecuciones
             WHERE flujo_id = ? AND negocio_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY estado`,
            [req.params.id, req.negocioId]
        );
        const [abandonos] = await db.execute(
            `SELECT nodo_actual, COUNT(*) AS total FROM flujo_ejecuciones
             WHERE flujo_id = ? AND negocio_id = ? AND estado = 'esperando_respuesta'
               AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR) AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY nodo_actual ORDER BY total DESC LIMIT 10`,
            [req.params.id, req.negocioId, HORAS_VIGENCIA_RESPUESTA]
        );
        res.json(F.resumirMetricas(porEstado, abandonos));
    } catch (error) {
        console.error('[Flujos] Error en métricas:', error.message);
        res.status(500).json({ error: 'Error al obtener las métricas' });
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
