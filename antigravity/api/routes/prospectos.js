// Registro de prospectos (posibles clientes de la plataforma) — solo administradores.
// Montado en /api/admin/prospectos. Nada de esto envía mensajes: el envío lo hace el admin
// desde su propio WhatsApp con el enlace wa.me que arma el panel (evita spam y bloqueos).
const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { asegurarTablaProspectos } = require('../../db/prospectosTabla');
const { verificarAuth } = require('../middleware/auth');
const { verificarAdmin } = require('../middleware/admin');
const { ESTADOS, validarProspecto } = require('../services/prospectos');

router.use(verificarAuth);
router.use(verificarAdmin);
router.use((req, res, next) => asegurarTablaProspectos(db).then(() => next(), next));

// mysql2 devuelve las columnas DATE como Date a medianoche local; al serializar a JSON pueden
// correrse un día según la zona del servidor. Se entregan como texto AAAA-MM-DD.
const fila = (p) => {
    const f = p.proximo_seguimiento;
    if (f instanceof Date) {
        const dos = (n) => String(n).padStart(2, '0');
        return { ...p, proximo_seguimiento: `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}` };
    }
    return p;
};

// GET /api/admin/prospectos?estado=&q=&seguimiento=hoy
router.get('/', async (req, res) => {
    try {
        const { estado, q, seguimiento } = req.query;
        const where = [];
        const params = [];
        if (estado && ESTADOS.includes(estado)) { where.push('estado = ?'); params.push(estado); }
        if (q) {
            where.push('(nombre_negocio LIKE ? OR contacto LIKE ? OR whatsapp LIKE ? OR ciudad LIKE ?)');
            const like = `%${String(q).slice(0, 80)}%`;
            params.push(like, like, like, like);
        }
        if (seguimiento === 'hoy') where.push("proximo_seguimiento IS NOT NULL AND proximo_seguimiento <= CURDATE() AND estado NOT IN ('cliente','descartado')");

        const [prospectos] = await db.execute(
            `SELECT * FROM prospectos ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
             ORDER BY (proximo_seguimiento IS NULL), proximo_seguimiento ASC, created_at DESC LIMIT 500`,
            params
        );
        const [conteos] = await db.execute('SELECT estado, COUNT(*) as total FROM prospectos GROUP BY estado');
        const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
        conteos.forEach((c) => { porEstado[c.estado] = c.total; });
        const [[seg]] = await db.execute(
            "SELECT COUNT(*) as total FROM prospectos WHERE proximo_seguimiento IS NOT NULL AND proximo_seguimiento <= CURDATE() AND estado NOT IN ('cliente','descartado')"
        );
        res.json({ prospectos: prospectos.map(fila), stats: { por_estado: porEstado, seguimientos_pendientes: seg.total } });
    } catch (error) {
        console.error('[Prospectos] Error listando:', error.message);
        res.status(500).json({ error: 'Error al cargar prospectos' });
    }
});

router.post('/', async (req, res) => {
    const { error, datos } = validarProspecto(req.body);
    if (error) return res.status(400).json({ error });
    try {
        const campos = Object.keys(datos);
        const [r] = await db.execute(
            `INSERT INTO prospectos (${campos.join(', ')}, created_by) VALUES (${campos.map(() => '?').join(', ')}, ?)`,
            [...campos.map((c) => datos[c]), req.negocio.id]
        );
        const [[nuevo]] = await db.execute('SELECT * FROM prospectos WHERE id = ?', [r.insertId]);
        res.status(201).json({ prospecto: fila(nuevo) });
    } catch (err) {
        console.error('[Prospectos] Error creando:', err.message);
        res.status(500).json({ error: 'No se pudo guardar el prospecto' });
    }
});

router.put('/:id', async (req, res) => {
    const { error, datos } = validarProspecto(req.body, { parcial: true });
    if (error) return res.status(400).json({ error });
    const campos = Object.keys(datos);
    if (campos.length === 0) return res.status(400).json({ error: 'No hay campos para actualizar' });
    try {
        const [r] = await db.execute(
            `UPDATE prospectos SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
            [...campos.map((c) => datos[c]), req.params.id]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });
        const [[p]] = await db.execute('SELECT * FROM prospectos WHERE id = ?', [req.params.id]);
        res.json({ prospecto: fila(p) });
    } catch (err) {
        console.error('[Prospectos] Error actualizando:', err.message);
        res.status(500).json({ error: 'No se pudo actualizar el prospecto' });
    }
});

// El admin abrió WhatsApp con el mensaje: queda registrado el contacto y, si aún estaba en
// "nuevo"/"contactado", pasa a "video_enviado". Seguimiento sugerido a 3 días si no había uno.
router.post('/:id/marcar-enviado', async (req, res) => {
    try {
        const [r] = await db.execute(
            `UPDATE prospectos SET ultimo_contacto_at = NOW(),
                estado = IF(estado IN ('nuevo','contactado'), 'video_enviado', estado),
                proximo_seguimiento = COALESCE(proximo_seguimiento, DATE_ADD(CURDATE(), INTERVAL 3 DAY))
             WHERE id = ?`,
            [req.params.id]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });
        const [[p]] = await db.execute('SELECT * FROM prospectos WHERE id = ?', [req.params.id]);
        res.json({ prospecto: fila(p) });
    } catch (err) {
        console.error('[Prospectos] Error marcando enviado:', err.message);
        res.status(500).json({ error: 'No se pudo registrar el envío' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const [r] = await db.execute('DELETE FROM prospectos WHERE id = ?', [req.params.id]);
        if (r.affectedRows === 0) return res.status(404).json({ error: 'Prospecto no encontrado' });
        res.json({ ok: true });
    } catch (err) {
        console.error('[Prospectos] Error eliminando:', err.message);
        res.status(500).json({ error: 'No se pudo eliminar el prospecto' });
    }
});

module.exports = router;
