// Inventario con movimientos (Fase 1 de docs/ecosistema-inventario-facturacion.md).
//
// Regla de oro: el stock de un producto NUNCA se cambia con un UPDATE suelto; todo pasa por
// `registrarMovimiento`, que bloquea la fila, valida que no quede negativo y deja el historial.
// Así dos ventas simultáneas no pueden vender la última unidad dos veces.
//
// `controla_stock` es opt-in por producto: los que no lo activan (servicios, platos, etc.) se
// venden sin límite y su `stock` es solo informativo, como siempre.

const TIPOS = ['entrada', 'salida', 'ajuste', 'devolucion'];
const MAX_CANTIDAD = 1000000;

class ErrorInventario extends Error {
    constructor(codigo, mensaje, detalle = {}) {
        super(mensaje);
        this.codigo = codigo;
        this.detalle = detalle;
    }
}

/** Stock resultante de aplicar `delta`, o lanza si quedaría negativo. */
function calcularNuevoStock(actual, delta) {
    const nuevo = Number(actual) + Number(delta);
    if (nuevo < 0) throw new ErrorInventario('STOCK_INSUFICIENTE', 'No hay suficiente stock', { disponible: Math.max(0, Number(actual)), pedido: Math.abs(Number(delta)) });
    return nuevo;
}

function validarDelta(delta) {
    const n = Number(delta);
    if (!Number.isInteger(n) || n === 0 || Math.abs(n) > MAX_CANTIDAD) throw new ErrorInventario('CANTIDAD_INVALIDA', 'La cantidad debe ser un número entero distinto de cero');
    return n;
}

/**
 * Un movimiento dentro de una transacción ya abierta (`con` = conexión con beginTransaction).
 * `delta` es con signo: positivo suma, negativo resta. Devuelve { stock_anterior, stock_nuevo }.
 */
async function registrarMovimiento(con, { negocioId, productoId, tipo, delta, motivo = null, referenciaTipo = null, referenciaId = null }) {
    if (!TIPOS.includes(tipo)) throw new ErrorInventario('TIPO_INVALIDO', 'Tipo de movimiento no válido');
    const d = validarDelta(delta);
    if ((tipo === 'entrada' || tipo === 'devolucion') && d < 0) throw new ErrorInventario('CANTIDAD_INVALIDA', 'Una entrada debe sumar');
    if (tipo === 'salida' && d > 0) throw new ErrorInventario('CANTIDAD_INVALIDA', 'Una salida debe restar');

    const [filas] = await con.execute('SELECT id, nombre, stock FROM productos WHERE id = ? AND negocio_id = ? FOR UPDATE', [productoId, negocioId]);
    if (filas.length === 0) throw new ErrorInventario('PRODUCTO_NO_ENCONTRADO', 'Producto no encontrado');
    const { nombre, stock } = filas[0];

    let nuevo;
    try {
        nuevo = calcularNuevoStock(stock, d);
    } catch (e) {
        if (e instanceof ErrorInventario) e.detalle = { ...e.detalle, producto_id: productoId, nombre };
        throw e;
    }
    await con.execute('UPDATE productos SET stock = ? WHERE id = ? AND negocio_id = ?', [nuevo, productoId, negocioId]);
    await con.execute(
        `INSERT INTO inventario_movimientos (negocio_id, producto_id, tipo, cantidad, stock_resultante, motivo, referencia_tipo, referencia_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [negocioId, productoId, tipo, d, nuevo, motivo ? String(motivo).slice(0, 160) : null, referenciaTipo, referenciaId]
    );
    return { stock_anterior: Number(stock), stock_nuevo: nuevo };
}

/** Ejecuta `fn(con)` en una transacción; confirma si termina bien y deshace todo si lanza. */
async function conTransaccion(pool, fn) {
    const con = await pool.getConnection();
    try {
        await con.beginTransaction();
        const r = await fn(con);
        await con.commit();
        return r;
    } catch (e) {
        try { await con.rollback(); } catch (_) { /* conexión ya caída */ }
        throw e;
    } finally {
        con.release();
    }
}

/** Mueve el stock de UN producto (ajuste manual, entrada de mercancía...). */
function ajustarStock(pool, params) {
    return conTransaccion(pool, (con) => registrarMovimiento(con, params));
}

/** Junta ítems repetidos del mismo producto: [{producto_id, cantidad}] → Map(producto_id → cantidad total). */
function agruparItems(items) {
    const m = new Map();
    for (const it of items || []) {
        const id = Number(it.producto_id);
        const c = Math.floor(Number(it.cantidad));
        if (!id || !(c > 0)) continue;
        m.set(id, (m.get(id) || 0) + c);
    }
    return m;
}

/**
 * Revisa (sin tocar nada) si alcanza el stock de los productos que lo controlan.
 * Devuelve { ok, faltantes: [{producto_id, nombre, disponible, pedido}] }.
 * Es una comprobación rápida para responderle al cliente antes de crear el pedido; la garantía real la da `descontarPedido`.
 */
async function verificarDisponibilidad(db, negocioId, items) {
    const pedidos = agruparItems(items);
    if (pedidos.size === 0) return { ok: true, faltantes: [] };
    const ids = [...pedidos.keys()];
    const [filas] = await db.execute(
        `SELECT id, nombre, stock, controla_stock FROM productos WHERE negocio_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
        [negocioId, ...ids]
    );
    const faltantes = [];
    for (const f of filas) {
        if (!f.controla_stock) continue;
        const pedido = pedidos.get(f.id);
        if (Number(f.stock) < pedido) faltantes.push({ producto_id: f.id, nombre: f.nombre, disponible: Math.max(0, Number(f.stock)), pedido });
    }
    return { ok: faltantes.length === 0, faltantes };
}

/**
 * Descuenta del stock los productos de un pedido (solo los que controlan stock), todo o nada.
 * Los bloquea en orden de id para que dos pedidos simultáneos no se bloqueen entre sí.
 * Devuelve { ok: true } o { ok: false, faltantes }.
 */
async function descontarPedido(pool, { negocioId, pedidoId, numeroPedido, items }) {
    const pedidos = agruparItems(items);
    if (pedidos.size === 0) return { ok: true };
    try {
        await conTransaccion(pool, async (con) => {
            const ids = [...pedidos.keys()].sort((a, b) => a - b);
            const [filas] = await con.execute(
                `SELECT id, controla_stock FROM productos WHERE negocio_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
                [negocioId, ...ids]
            );
            const controlados = new Set(filas.filter((f) => f.controla_stock).map((f) => f.id));
            for (const id of ids) {
                if (!controlados.has(id)) continue;
                await registrarMovimiento(con, {
                    negocioId, productoId: id, tipo: 'salida', delta: -pedidos.get(id),
                    motivo: `Venta ${numeroPedido || `#${pedidoId}`}`, referenciaTipo: 'pedido', referenciaId: pedidoId,
                });
            }
        });
        return { ok: true };
    } catch (e) {
        if (e instanceof ErrorInventario && e.codigo === 'STOCK_INSUFICIENTE') {
            return { ok: false, faltantes: [{ producto_id: e.detalle.producto_id, nombre: e.detalle.nombre, disponible: e.detalle.disponible, pedido: e.detalle.pedido }] };
        }
        throw e;
    }
}

/**
 * Devuelve al stock lo que descontó un pedido (al cancelarlo). Idempotente: solo repone lo que
 * falta por devolver, así que llamarla dos veces no suma de más.
 */
async function devolverPedido(pool, { negocioId, pedidoId, numeroPedido }) {
    return conTransaccion(pool, async (con) => {
        const [movs] = await con.execute(
            `SELECT producto_id, SUM(cantidad) AS neto FROM inventario_movimientos
             WHERE negocio_id = ? AND referencia_tipo = 'pedido' AND referencia_id = ? AND tipo IN ('salida', 'devolucion')
             GROUP BY producto_id ORDER BY producto_id`,
            [negocioId, pedidoId]
        );
        let devueltos = 0;
        for (const m of movs) {
            const neto = Number(m.neto); // negativo = salió más de lo que volvió
            if (neto >= 0) continue;
            await registrarMovimiento(con, {
                negocioId, productoId: m.producto_id, tipo: 'devolucion', delta: -neto,
                motivo: `Pedido ${numeroPedido || `#${pedidoId}`} cancelado`, referenciaTipo: 'pedido', referenciaId: pedidoId,
            });
            devueltos++;
        }
        return { devueltos };
    });
}

/** Frase para el cliente cuando no alcanza el stock. */
function mensajeSinStock(faltantes) {
    const lineas = faltantes.map((f) => (f.disponible > 0
        ? `• ${f.nombre}: solo quedan ${f.disponible} (pediste ${f.pedido})`
        : `• ${f.nombre}: está agotado por ahora`));
    return `Uy, no alcanzo a completar tu pedido con lo que hay disponible 🙈\n\n${lineas.join('\n')}\n\n¿Quieres ajustar las cantidades o elegir otra cosa?`;
}

module.exports = {
    TIPOS, ErrorInventario, calcularNuevoStock, validarDelta, registrarMovimiento, conTransaccion, ajustarStock,
    agruparItems, verificarDisponibilidad, descontarPedido, devolverPedido, mensajeSinStock,
};
