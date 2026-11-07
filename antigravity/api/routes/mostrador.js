// Venta de mostrador y caja del local. Plan Starter en adelante: cobrar y ver el resumen del día.
// Plan Professional en adelante (cajaAvanzada): turnos con arqueo, gastos e historial de cierres.
const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { injectTenantId, checkFeature } = require('../middleware/tenant');
const inventario = require('../services/inventario');
const V = require('../services/ventasMostrador');

router.use(verificarAuth, injectTenantId, checkFeature('ventaMostrador'));
const avanzada = checkFeature('cajaAvanzada');

// Errores conocidos con un mensaje claro; lo demás es un 500 genérico.
function responderError(res, e, etiqueta) {
    if (e instanceof V.ErrorVenta) return res.status(e.estado).json({ error: e.message, codigo: e.codigo, ...e.detalle });
    if (e instanceof inventario.ErrorInventario) {
        const mensaje = e.codigo === 'STOCK_INSUFICIENTE' ? `No alcanza el stock de "${e.detalle.nombre}": solo hay ${e.detalle.disponible}` : e.message;
        return res.status(e.codigo === 'PRODUCTO_NO_ENCONTRADO' ? 404 : 409).json({ error: mensaje, codigo: e.codigo, ...e.detalle });
    }
    console.error(`[Mostrador] ${etiqueta}:`, e.message);
    return res.status(500).json({ error: 'Ocurrió un error. Intenta de nuevo.' });
}

// Productos para vender (solo activos), con lo necesario para la pantalla de cobro.
router.get('/productos', async (req, res) => {
    try {
        const [filas] = await db.execute(
            'SELECT id, nombre, precio, stock, controla_stock, sku, imagen_url FROM productos WHERE negocio_id = ? AND activo = 1 ORDER BY nombre LIMIT 500',
            [req.negocioId]
        );
        res.json({ productos: filas.map((p) => ({ ...p, precio: Number(p.precio), controla_stock: !!p.controla_stock })) });
    } catch (e) { responderError(res, e, 'productos'); }
});

router.post('/ventas', async (req, res) => {
    try {
        const v = V.validarVenta(req.body);
        if (v.error) return res.status(400).json({ error: v.error });
        const venta = await V.crearVenta(db, req.negocioId, v.datos);
        res.status(201).json({ venta });
    } catch (e) { responderError(res, e, 'crear venta'); }
});

// Últimas ventas del día (o de una fecha AAAA-MM-DD) con sus productos.
router.get('/ventas', async (req, res) => {
    try {
        const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.fecha || '')) ? req.query.fecha : null;
        const [ventas] = await db.execute(
            `SELECT id, numero, total, metodo_pago, recibido, estado, nota, turno_id, created_at FROM ventas_mostrador
             WHERE negocio_id = ? AND DATE(created_at) = ${fecha ? '?' : 'CURDATE()'} ORDER BY id DESC LIMIT 100`,
            fecha ? [req.negocioId, fecha] : [req.negocioId]
        );
        let items = [];
        if (ventas.length) {
            [items] = await db.execute(
                `SELECT venta_id, nombre, cantidad, precio_unitario FROM ventas_mostrador_items WHERE venta_id IN (${ventas.map(() => '?').join(',')}) ORDER BY id`,
                ventas.map((x) => x.id)
            );
        }
        res.json({ ventas: ventas.map((x) => ({ ...x, total: Number(x.total), items: items.filter((i) => i.venta_id === x.id).map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio_unitario: Number(i.precio_unitario) })) })) });
    } catch (e) { responderError(res, e, 'listar ventas'); }
});

router.post('/ventas/:id/anular', async (req, res) => {
    try {
        res.json({ anulada: await V.anularVenta(db, req.negocioId, Number(req.params.id)) });
    } catch (e) { responderError(res, e, 'anular venta'); }
});

// Resumen del día (sin turnos): ventas pagadas por método de pago.
router.get('/resumen-dia', async (req, res) => {
    try {
        const [filas] = await db.execute(
            "SELECT metodo_pago, COUNT(*) AS ventas, SUM(total) AS total FROM ventas_mostrador WHERE negocio_id = ? AND DATE(created_at) = CURDATE() AND estado = 'pagada' GROUP BY metodo_pago",
            [req.negocioId]
        );
        const por_metodo = {};
        let total = 0, ventas = 0;
        for (const f of filas) { por_metodo[f.metodo_pago] = { ventas: Number(f.ventas), total: V.dinero(f.total) }; total = V.dinero(total + Number(f.total)); ventas += Number(f.ventas); }
        res.json({ ventas, total, por_metodo });
    } catch (e) { responderError(res, e, 'resumen del día'); }
});

// ---- Turnos de caja (plan Professional en adelante) ----
router.get('/turno/actual', avanzada, async (req, res) => {
    try {
        const turno = await V.turnoAbierto(db, req.negocioId);
        res.json({ turno: turno ? await V.resumenTurno(db, req.negocioId, turno) : null });
    } catch (e) { responderError(res, e, 'turno actual'); }
});

router.post('/turno/abrir', avanzada, async (req, res) => {
    try {
        const m = V.validarMonto(req.body && req.body.monto_inicial);
        if (m.error) return res.status(400).json({ error: m.error });
        if (await V.turnoAbierto(db, req.negocioId)) return res.status(409).json({ error: 'Ya hay un turno abierto. Ciérralo antes de abrir otro.', codigo: 'TURNO_ABIERTO' });
        const [r] = await db.execute('INSERT INTO caja_turnos (negocio_id, monto_inicial) VALUES (?, ?)', [req.negocioId, m.monto]);
        res.status(201).json({ turno: await V.resumenTurno(db, req.negocioId, { id: r.insertId, monto_inicial: m.monto, abierto_en: new Date() }) });
    } catch (e) { responderError(res, e, 'abrir turno'); }
});

router.post('/turno/cerrar', avanzada, async (req, res) => {
    try {
        const m = V.validarMonto(req.body && req.body.monto_contado);
        if (m.error) return res.status(400).json({ error: 'Escribe cuánta plata contaste en la caja' });
        const turno = await V.turnoAbierto(db, req.negocioId);
        if (!turno) return res.status(409).json({ error: 'No hay un turno abierto', codigo: 'SIN_TURNO' });
        const resumen = await V.resumenTurno(db, req.negocioId, turno);
        const notas = typeof req.body.notas === 'string' ? req.body.notas.trim().slice(0, 200) : null;
        const [r] = await db.execute(
            'UPDATE caja_turnos SET cerrado_en = NOW(), monto_contado = ?, monto_esperado = ?, notas = ? WHERE id = ? AND negocio_id = ? AND cerrado_en IS NULL',
            [m.monto, resumen.efectivo_esperado, notas || null, turno.id, req.negocioId]
        );
        if (r.affectedRows === 0) return res.status(409).json({ error: 'Este turno ya estaba cerrado', codigo: 'SIN_TURNO' });
        res.json({ cierre: { ...resumen, monto_contado: m.monto, diferencia: V.dinero(m.monto - resumen.efectivo_esperado) } });
    } catch (e) { responderError(res, e, 'cerrar turno'); }
});

router.post('/gastos', avanzada, async (req, res) => {
    try {
        const m = V.validarMonto(req.body && req.body.monto, { permitirCero: false });
        const concepto = typeof (req.body && req.body.concepto) === 'string' ? req.body.concepto.trim().slice(0, 120) : '';
        if (m.error || !concepto) return res.status(400).json({ error: 'Escribe el concepto y un monto mayor a cero' });
        const turno = await V.turnoAbierto(db, req.negocioId);
        if (!turno) return res.status(409).json({ error: 'Abre un turno para registrar gastos', codigo: 'SIN_TURNO' });
        await db.execute('INSERT INTO caja_gastos (negocio_id, turno_id, concepto, monto) VALUES (?, ?, ?, ?)', [req.negocioId, turno.id, concepto, m.monto]);
        res.status(201).json({ turno: await V.resumenTurno(db, req.negocioId, turno) });
    } catch (e) { responderError(res, e, 'registrar gasto'); }
});

router.get('/turnos', avanzada, async (req, res) => {
    try {
        const [filas] = await db.execute(
            `SELECT id, monto_inicial, abierto_en, cerrado_en, monto_contado, monto_esperado, notas FROM caja_turnos
             WHERE negocio_id = ? AND cerrado_en IS NOT NULL ORDER BY id DESC LIMIT 30`,
            [req.negocioId]
        );
        res.json({ turnos: filas.map((t) => ({ ...t, monto_inicial: Number(t.monto_inicial), monto_contado: Number(t.monto_contado), monto_esperado: Number(t.monto_esperado), diferencia: V.dinero(Number(t.monto_contado) - Number(t.monto_esperado)) })) });
    } catch (e) { responderError(res, e, 'historial de turnos'); }
});

module.exports = router;
