// Fiado (cuentas por cobrar) de la venta de mostrador: a quién le fiaste, cuánto te debe y sus abonos.
// El saldo NO se guarda: siempre es la suma de los movimientos (cargos − abonos, sin los anulados), así
// nunca queda desfasado. Un cargo nace al vender con método "fiado"; un abono lo registra el dueño.
const inventario = require('./inventario');

const METODOS_ABONO = ['efectivo', 'nequi', 'tarjeta', 'transferencia', 'otro'];
const MAX_MONTO = 1000000000;
const MAX_CLIENTES = 1000;

class ErrorFiado extends Error {
    constructor(codigo, mensaje, estado = 400, detalle = {}) {
        super(mensaje);
        this.codigo = codigo; this.estado = estado; this.detalle = detalle;
    }
}

const dinero = (v) => Math.round(Number(v) * 100) / 100;

function verificarId(id) {
    if (!Number.isInteger(id) || id <= 0) throw new ErrorFiado('CLIENTE_NO_ENCONTRADO', 'Ese cliente de fiado no existe', 404);
}

/** Celular colombiano → solo dígitos con 57 delante (para abrir WhatsApp). Vacío = sin celular. */
function normalizarTelefono(t) {
    const crudo = String(t ?? '').trim();
    const d = crudo.replace(/\D/g, '');
    if (!crudo) return { telefono: null };
    if (!d) return { error: 'El celular no es válido. Escríbelo con 10 dígitos, por ejemplo 3001234567' };
    if (/^3\d{9}$/.test(d)) return { telefono: `57${d}` };
    if (/^573\d{9}$/.test(d)) return { telefono: d };
    return { error: 'El celular no es válido. Escríbelo con 10 dígitos, por ejemplo 3001234567' };
}

function validarCliente(body = {}) {
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
    if (!nombre) return { error: 'Escribe el nombre de quien te debe' };
    const tel = normalizarTelefono(body.telefono);
    if (tel.error) return { error: tel.error };
    return { datos: { nombre, telefono: tel.telefono } };
}

async function crearCliente(db, negocioId, body) {
    const v = validarCliente(body);
    if (v.error) throw new ErrorFiado('CLIENTE_INVALIDO', v.error);
    const [cnt] = await db.execute('SELECT COUNT(*) AS total FROM fiado_clientes WHERE negocio_id = ?', [negocioId]);
    if (Number(cnt[0].total) >= MAX_CLIENTES) throw new ErrorFiado('LIMITE_CLIENTES', `Llegaste al máximo de ${MAX_CLIENTES} clientes de fiado`, 409);
    try {
        const [r] = await db.execute('INSERT INTO fiado_clientes (negocio_id, nombre, telefono) VALUES (?, ?, ?)', [negocioId, v.datos.nombre, v.datos.telefono]);
        return { id: r.insertId, nombre: v.datos.nombre, telefono: v.datos.telefono, saldo: 0 };
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') throw new ErrorFiado('CLIENTE_REPETIDO', 'Ya tienes un cliente con ese nombre', 409);
        throw e;
    }
}

/** Todos los clientes con su saldo (los que más deben primero) y el total por cobrar. */
async function listarClientes(db, negocioId) {
    const [filas] = await db.execute(
        `SELECT c.id, c.nombre, c.telefono,
                COALESCE(SUM(CASE WHEN m.anulado = 0 THEN (CASE WHEN m.tipo = 'cargo' THEN m.monto ELSE -m.monto END) ELSE 0 END), 0) AS saldo,
                MAX(m.created_at) AS ultimo_movimiento
         FROM fiado_clientes c LEFT JOIN fiado_movimientos m ON m.cliente_id = c.id
         WHERE c.negocio_id = ? GROUP BY c.id, c.nombre, c.telefono ORDER BY saldo DESC, c.nombre LIMIT 1000`,
        [negocioId]
    );
    const clientes = filas.map((f) => ({ id: f.id, nombre: f.nombre, telefono: f.telefono, saldo: dinero(f.saldo), ultimo_movimiento: f.ultimo_movimiento }));
    const totalPorCobrar = dinero(clientes.reduce((s, c) => s + Math.max(0, c.saldo), 0));
    return { total_por_cobrar: totalPorCobrar, deudores: clientes.filter((c) => c.saldo > 0).length, clientes };
}

async function saldoDe(con, negocioId, clienteId) {
    const [r] = await con.execute(
        "SELECT COALESCE(SUM(CASE WHEN tipo = 'cargo' THEN monto ELSE -monto END), 0) AS saldo FROM fiado_movimientos WHERE negocio_id = ? AND cliente_id = ? AND anulado = 0",
        [negocioId, clienteId]
    );
    return dinero(r[0] ? r[0].saldo : 0);
}

/** Bloquea la fila del cliente (así dos cobros a la vez no se pisan) y confirma que es de este negocio. */
async function bloquearCliente(con, negocioId, clienteId) {
    verificarId(clienteId);
    const [c] = await con.execute('SELECT id FROM fiado_clientes WHERE id = ? AND negocio_id = ? FOR UPDATE', [clienteId, negocioId]);
    if (c.length === 0) throw new ErrorFiado('CLIENTE_NO_ENCONTRADO', 'Ese cliente de fiado no existe', 404);
}

/** Anota lo fiado de una venta. Se llama dentro de la misma transacción que crea la venta. */
async function registrarCargoDeVenta(con, { negocioId, clienteId, ventaId, monto, turnoId, nota }) {
    await bloquearCliente(con, negocioId, clienteId);
    await con.execute(
        "INSERT INTO fiado_movimientos (negocio_id, cliente_id, tipo, monto, venta_id, turno_id, metodo_pago, nota) VALUES (?, ?, 'cargo', ?, ?, ?, NULL, ?)",
        [negocioId, clienteId, monto, ventaId, turnoId, nota || null]
    );
}

/** Al anular la venta, lo que se fió deja de contar. */
async function anularCargosDeVenta(con, negocioId, ventaId) {
    await con.execute("UPDATE fiado_movimientos SET anulado = 1 WHERE negocio_id = ? AND venta_id = ? AND tipo = 'cargo'", [negocioId, ventaId]);
}

function validarAbono(body = {}) {
    const monto = dinero(body.monto);
    if (!Number.isFinite(monto) || monto <= 0 || monto > MAX_MONTO) return { error: 'Escribe cuánto te pagó (mayor a cero)' };
    const metodo = body.metodo_pago === undefined ? 'efectivo' : body.metodo_pago;
    if (!METODOS_ABONO.includes(metodo)) return { error: `Método de pago no válido. Usa: ${METODOS_ABONO.join(', ')}` };
    const nota = typeof body.nota === 'string' ? body.nota.trim().slice(0, 200) : null;
    return { datos: { monto, metodo_pago: metodo, nota: nota || null } };
}

/** Un abono nunca puede ser mayor que lo que debe (si pagó de más se corrige a mano). */
async function registrarAbono(pool, negocioId, clienteId, body) {
    const v = validarAbono(body);
    if (v.error) throw new ErrorFiado('ABONO_INVALIDO', v.error);
    return inventario.conTransaccion(pool, async (con) => {
        await bloquearCliente(con, negocioId, clienteId);
        const antes = await saldoDe(con, negocioId, clienteId);
        if (v.datos.monto > antes) {
            throw new ErrorFiado('ABONO_MAYOR', antes > 0 ? `Solo debe $${antes}: no puedes abonar más` : 'Este cliente no debe nada', 409, { saldo: antes });
        }
        const [t] = await con.execute('SELECT id FROM caja_turnos WHERE negocio_id = ? AND cerrado_en IS NULL ORDER BY id DESC LIMIT 1', [negocioId]);
        await con.execute(
            "INSERT INTO fiado_movimientos (negocio_id, cliente_id, tipo, monto, venta_id, turno_id, metodo_pago, nota) VALUES (?, ?, 'abono', ?, NULL, ?, ?, ?)",
            [negocioId, clienteId, v.datos.monto, t[0] ? t[0].id : null, v.datos.metodo_pago, v.datos.nota]
        );
        return { saldo_anterior: antes, saldo: dinero(antes - v.datos.monto) };
    });
}

/** Cliente con sus últimos movimientos (cargos con el número de la venta). */
async function detalleCliente(db, negocioId, clienteId) {
    verificarId(clienteId);
    const [c] = await db.execute('SELECT id, nombre, telefono FROM fiado_clientes WHERE id = ? AND negocio_id = ?', [clienteId, negocioId]);
    if (c.length === 0) throw new ErrorFiado('CLIENTE_NO_ENCONTRADO', 'Ese cliente de fiado no existe', 404);
    const [movs] = await db.execute(
        `SELECT m.id, m.tipo, m.monto, m.metodo_pago, m.nota, m.anulado, m.created_at, v.numero AS venta_numero
         FROM fiado_movimientos m LEFT JOIN ventas_mostrador v ON v.id = m.venta_id
         WHERE m.negocio_id = ? AND m.cliente_id = ? ORDER BY m.id DESC LIMIT 50`,
        [negocioId, clienteId]
    );
    return {
        cliente: { ...c[0], saldo: await saldoDe(db, negocioId, clienteId) },
        movimientos: movs.map((m) => ({ ...m, monto: dinero(m.monto), anulado: !!m.anulado })),
    };
}

/** Lo que se cobró en efectivo por abonos durante un turno: entra a la caja y debe contar en el arqueo. */
async function abonosEfectivoDelTurno(db, negocioId, turnoId) {
    const [r] = await db.execute(
        "SELECT SUM(monto) AS total FROM fiado_movimientos WHERE negocio_id = ? AND turno_id = ? AND tipo = 'abono' AND metodo_pago = 'efectivo' AND anulado = 0",
        [negocioId, turnoId]
    );
    return dinero((r[0] && r[0].total) || 0);
}

module.exports = {
    ErrorFiado, METODOS_ABONO, normalizarTelefono, validarCliente, crearCliente, listarClientes, registrarCargoDeVenta,
    anularCargosDeVenta, validarAbono, registrarAbono, detalleCliente, abonosEfectivoDelTurno,
};
