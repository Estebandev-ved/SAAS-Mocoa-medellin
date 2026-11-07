// Venta de mostrador: cobrar en el local con el mismo inventario que usa el bot, y manejar los turnos de caja.
// Los precios SIEMPRE salen de la base (nunca del navegador) y el stock se mueve solo con `inventario.registrarMovimiento`.

const inventario = require('./inventario');

const METODOS = ['efectivo', 'nequi', 'tarjeta', 'transferencia', 'otro'];
const MAX_ITEMS = 60;
const MAX_CANTIDAD = 10000;
const MAX_MONTO = 1000000000;

class ErrorVenta extends Error {
    constructor(codigo, mensaje, estado = 400, detalle = {}) {
        super(mensaje);
        this.codigo = codigo; this.estado = estado; this.detalle = detalle;
    }
}

const dinero = (v) => Math.round(Number(v) * 100) / 100;

/** Valida lo que llega del navegador. Devuelve { datos } o { error }. */
function validarVenta(body = {}) {
    const items = new Map();
    if (!Array.isArray(body.items) || body.items.length === 0) return { error: 'Agrega al menos un producto' };
    if (body.items.length > MAX_ITEMS) return { error: `Una venta puede tener hasta ${MAX_ITEMS} productos distintos` };
    for (const it of body.items) {
        const id = Number(it && it.producto_id);
        const c = Number(it && it.cantidad);
        if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(c) || c <= 0 || c > MAX_CANTIDAD) return { error: 'Hay un producto o una cantidad no válida' };
        items.set(id, (items.get(id) || 0) + c);
    }
    const metodo = body.metodo_pago === undefined ? 'efectivo' : body.metodo_pago;
    if (!METODOS.includes(metodo)) return { error: `Método de pago no válido. Usa: ${METODOS.join(', ')}` };
    let recibido = null;
    if (body.recibido !== undefined && body.recibido !== null && body.recibido !== '') {
        recibido = dinero(body.recibido);
        if (!Number.isFinite(recibido) || recibido < 0 || recibido > MAX_MONTO) return { error: 'El monto recibido no es válido' };
    }
    const nota = typeof body.nota === 'string' ? body.nota.trim().slice(0, 200) : null;
    return { datos: { items: [...items].map(([producto_id, cantidad]) => ({ producto_id, cantidad })), metodo_pago: metodo, recibido, nota: nota || null } };
}

/** Número legible de la venta: M-AAAAMMDD-000123 */
function numeroVenta(id, fecha = new Date()) {
    const f = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
    return `M-${f}-${String(id).padStart(6, '0')}`;
}

async function turnoAbierto(db, negocioId) {
    const [f] = await db.execute('SELECT * FROM caja_turnos WHERE negocio_id = ? AND cerrado_en IS NULL ORDER BY id DESC LIMIT 1', [negocioId]);
    return f[0] || null;
}

/** Cobra una venta: todo o nada (si un producto no alcanza, no se descuenta nada ni se registra la venta). */
async function crearVenta(pool, negocioId, datos) {
    return inventario.conTransaccion(pool, async (con) => {
        const ids = datos.items.map((i) => i.producto_id).sort((a, b) => a - b);
        const [prods] = await con.execute(
            `SELECT id, nombre, precio, controla_stock FROM productos WHERE negocio_id = ? AND activo = 1 AND id IN (${ids.map(() => '?').join(',')}) ORDER BY id`,
            [negocioId, ...ids]
        );
        const porId = new Map(prods.map((p) => [p.id, p]));
        let total = 0;
        const lineas = [];
        for (const it of datos.items) {
            const p = porId.get(it.producto_id);
            if (!p) throw new ErrorVenta('PRODUCTO_NO_ENCONTRADO', 'Un producto ya no existe o está desactivado', 404);
            const precio = dinero(p.precio);
            total = dinero(total + precio * it.cantidad);
            lineas.push({ p, cantidad: it.cantidad, precio });
        }
        if (total <= 0) throw new ErrorVenta('TOTAL_INVALIDO', 'El total de la venta debe ser mayor a cero');
        if (total > MAX_MONTO) throw new ErrorVenta('TOTAL_INVALIDO', 'El total es demasiado grande');
        if (datos.metodo_pago === 'efectivo' && datos.recibido !== null && datos.recibido < total) {
            throw new ErrorVenta('RECIBIDO_INSUFICIENTE', `Lo recibido ($${datos.recibido}) no cubre el total ($${total})`);
        }

        const turno = await (async () => {
            const [t] = await con.execute('SELECT id FROM caja_turnos WHERE negocio_id = ? AND cerrado_en IS NULL ORDER BY id DESC LIMIT 1', [negocioId]);
            return t[0] ? t[0].id : null;
        })();
        const [r] = await con.execute(
            'INSERT INTO ventas_mostrador (negocio_id, turno_id, total, metodo_pago, recibido, nota) VALUES (?, ?, ?, ?, ?, ?)',
            [negocioId, turno, total, datos.metodo_pago, datos.metodo_pago === 'efectivo' ? datos.recibido : null, datos.nota]
        );
        const ventaId = r.insertId;
        const numero = numeroVenta(ventaId);
        await con.execute('UPDATE ventas_mostrador SET numero = ? WHERE id = ?', [numero, ventaId]);

        for (const l of lineas) {
            await con.execute(
                'INSERT INTO ventas_mostrador_items (venta_id, producto_id, nombre, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)',
                [ventaId, l.p.id, l.p.nombre, l.cantidad, l.precio]
            );
            if (l.p.controla_stock) {
                await inventario.registrarMovimiento(con, {
                    negocioId, productoId: l.p.id, tipo: 'salida', delta: -l.cantidad,
                    motivo: `Venta de mostrador ${numero}`, referenciaTipo: 'mostrador', referenciaId: ventaId,
                });
            }
        }
        const cambio = datos.metodo_pago === 'efectivo' && datos.recibido !== null ? dinero(datos.recibido - total) : null;
        return { id: ventaId, numero, total, metodo_pago: datos.metodo_pago, cambio, turno_id: turno };
    });
}

/** Anula una venta y devuelve el stock (una sola vez). */
async function anularVenta(pool, negocioId, ventaId) {
    return inventario.conTransaccion(pool, async (con) => {
        const [v] = await con.execute('SELECT id, numero, estado FROM ventas_mostrador WHERE id = ? AND negocio_id = ? FOR UPDATE', [ventaId, negocioId]);
        if (v.length === 0) throw new ErrorVenta('VENTA_NO_ENCONTRADA', 'Venta no encontrada', 404);
        if (v[0].estado === 'anulada') throw new ErrorVenta('YA_ANULADA', 'Esta venta ya fue anulada', 409);
        const [items] = await con.execute(
            `SELECT i.producto_id, i.cantidad FROM ventas_mostrador_items i JOIN productos p ON p.id = i.producto_id AND p.negocio_id = ?
             WHERE i.venta_id = ? AND p.controla_stock = 1 ORDER BY i.producto_id`,
            [negocioId, ventaId]
        );
        for (const it of items) {
            await inventario.registrarMovimiento(con, {
                negocioId, productoId: it.producto_id, tipo: 'devolucion', delta: Number(it.cantidad),
                motivo: `Venta ${v[0].numero} anulada`, referenciaTipo: 'mostrador', referenciaId: ventaId,
            });
        }
        await con.execute("UPDATE ventas_mostrador SET estado = 'anulada', anulada_en = NOW() WHERE id = ?", [ventaId]);
        return { id: ventaId, numero: v[0].numero, stock_devuelto: items.length };
    });
}

/** Valida un monto en pesos (gasto, apertura, conteo). */
function validarMonto(v, { permitirCero = true } = {}) {
    const n = dinero(v);
    if (!Number.isFinite(n) || n < 0 || n > MAX_MONTO || (!permitirCero && n === 0)) return { error: 'El monto no es válido' };
    return { monto: n };
}

/**
 * Cuentas de un turno: ventas por método, gastos y la plata que debería haber en la caja.
 * Esperado en efectivo = monto inicial + ventas en efectivo − gastos.
 */
async function resumenTurno(db, negocioId, turno) {
    const [porMetodo] = await db.execute(
        "SELECT metodo_pago, COUNT(*) AS ventas, SUM(total) AS total FROM ventas_mostrador WHERE negocio_id = ? AND turno_id = ? AND estado = 'pagada' GROUP BY metodo_pago",
        [negocioId, turno.id]
    );
    const [gastos] = await db.execute('SELECT SUM(monto) AS total, COUNT(*) AS cantidad FROM caja_gastos WHERE negocio_id = ? AND turno_id = ?', [negocioId, turno.id]);
    const metodos = {};
    let totalVentas = 0, cantidadVentas = 0;
    for (const m of porMetodo) {
        metodos[m.metodo_pago] = { ventas: Number(m.ventas), total: dinero(m.total) };
        totalVentas = dinero(totalVentas + Number(m.total));
        cantidadVentas += Number(m.ventas);
    }
    const totalGastos = dinero(gastos[0] && gastos[0].total ? gastos[0].total : 0);
    const efectivo = metodos.efectivo ? metodos.efectivo.total : 0;
    return {
        turno_id: turno.id, abierto_en: turno.abierto_en, monto_inicial: dinero(turno.monto_inicial),
        ventas: cantidadVentas, total_ventas: totalVentas, por_metodo: metodos,
        gastos: totalGastos, cantidad_gastos: Number(gastos[0] ? gastos[0].cantidad : 0),
        efectivo_esperado: dinero(Number(turno.monto_inicial) + efectivo - totalGastos),
    };
}

module.exports = { METODOS, ErrorVenta, validarVenta, numeroVenta, turnoAbierto, crearVenta, anularVenta, validarMonto, resumenTurno, dinero };
