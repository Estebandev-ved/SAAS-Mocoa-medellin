const test = require('node:test');
const assert = require('node:assert');
const I = require('../../api/services/inventario');

// Base simulada con transacciones (rollback restaura el estado) y las consultas que usa inventario.js.
function crearBd(productos) {
    const estado = { productos: new Map(productos.map((p) => [p.id, { negocio_id: 1, controla_stock: 1, ...p }])), movs: [] };
    let copia = null;
    const ejecutar = async (sql, p = []) => {
        const q = sql.replace(/\s+/g, ' ').trim();
        if (q.startsWith('SELECT id, nombre, stock FROM productos WHERE id = ? AND negocio_id = ? FOR UPDATE')) {
            const f = estado.productos.get(p[0]);
            return [f && f.negocio_id === p[1] ? [{ id: f.id, nombre: f.nombre, stock: f.stock }] : []];
        }
        if (q.startsWith('UPDATE productos SET stock = ?')) { estado.productos.get(p[1]).stock = p[0]; return [{ affectedRows: 1 }]; }
        if (q.startsWith('INSERT INTO inventario_movimientos')) {
            const [negocio_id, producto_id, tipo, cantidad, stock_resultante, motivo, referencia_tipo, referencia_id] = p;
            estado.movs.push({ negocio_id, producto_id, tipo, cantidad, stock_resultante, motivo, referencia_tipo, referencia_id });
            return [{}];
        }
        if (q.startsWith('SELECT id, controla_stock FROM productos')) {
            return [p.slice(1).map((id) => estado.productos.get(id)).filter((f) => f && f.negocio_id === p[0]).map((f) => ({ id: f.id, controla_stock: f.controla_stock }))];
        }
        if (q.startsWith('SELECT id, nombre, stock, controla_stock FROM productos')) {
            return [p.slice(1).map((id) => estado.productos.get(id)).filter(Boolean)];
        }
        if (q.startsWith('SELECT producto_id, SUM(cantidad) AS neto')) {
            const por = new Map();
            for (const m of estado.movs.filter((x) => x.negocio_id === p[0] && x.referencia_tipo === 'pedido' && x.referencia_id === p[1] && ['salida', 'devolucion'].includes(x.tipo))) {
                por.set(m.producto_id, (por.get(m.producto_id) || 0) + m.cantidad);
            }
            return [[...por.entries()].sort((a, b) => a[0] - b[0]).map(([producto_id, neto]) => ({ producto_id, neto }))];
        }
        throw new Error(`Consulta no simulada: ${q.slice(0, 80)}`);
    };
    const pool = {
        execute: ejecutar,
        async getConnection() {
            return {
                execute: ejecutar,
                async beginTransaction() { copia = { productos: new Map([...estado.productos].map(([k, v]) => [k, { ...v }])), movs: [...estado.movs] }; },
                async commit() { copia = null; },
                async rollback() { if (copia) { estado.productos = copia.productos; estado.movs = copia.movs; } },
                release() {},
            };
        },
    };
    return { estado, pool };
}

const camisa = { id: 1, nombre: 'Camisa', stock: 5 };
const gorra = { id: 2, nombre: 'Gorra', stock: 1 };
const servicio = { id: 3, nombre: 'Corte', stock: 0, controla_stock: 0 };

test('stock: no puede quedar negativo y la cantidad debe ser entera distinta de cero', () => {
    assert.strictEqual(I.calcularNuevoStock(5, -5), 0);
    assert.throws(() => I.calcularNuevoStock(5, -6), (e) => e.codigo === 'STOCK_INSUFICIENTE' && e.detalle.disponible === 5);
    assert.throws(() => I.validarDelta(0), (e) => e.codigo === 'CANTIDAD_INVALIDA');
    assert.throws(() => I.validarDelta(1.5), (e) => e.codigo === 'CANTIDAD_INVALIDA');
    assert.throws(() => I.validarDelta('abc'), (e) => e.codigo === 'CANTIDAD_INVALIDA');
});

test('ajustarStock suma, resta y deja historial con el saldo resultante', async () => {
    const { estado, pool } = crearBd([camisa]);
    let r = await I.ajustarStock(pool, { negocioId: 1, productoId: 1, tipo: 'entrada', delta: 10, motivo: 'Compra a proveedor' });
    assert.deepStrictEqual(r, { stock_anterior: 5, stock_nuevo: 15 });
    r = await I.ajustarStock(pool, { negocioId: 1, productoId: 1, tipo: 'ajuste', delta: -3, motivo: 'Merma' });
    assert.strictEqual(r.stock_nuevo, 12);
    assert.deepStrictEqual(estado.movs.map((m) => [m.tipo, m.cantidad, m.stock_resultante]), [['entrada', 10, 15], ['ajuste', -3, 12]]);
});

test('reglas por tipo y negocio ajeno', async () => {
    const { pool } = crearBd([camisa]);
    await assert.rejects(I.ajustarStock(pool, { negocioId: 1, productoId: 1, tipo: 'entrada', delta: -2 }), { codigo: 'CANTIDAD_INVALIDA' });
    await assert.rejects(I.ajustarStock(pool, { negocioId: 1, productoId: 1, tipo: 'salida', delta: 2 }), { codigo: 'CANTIDAD_INVALIDA' });
    await assert.rejects(I.ajustarStock(pool, { negocioId: 1, productoId: 1, tipo: 'robo', delta: 2 }), { codigo: 'TIPO_INVALIDO' });
    await assert.rejects(I.ajustarStock(pool, { negocioId: 2, productoId: 1, tipo: 'entrada', delta: 2 }), { codigo: 'PRODUCTO_NO_ENCONTRADO' });
    await assert.rejects(I.ajustarStock(pool, { negocioId: 1, productoId: 1, tipo: 'ajuste', delta: -99 }), { codigo: 'STOCK_INSUFICIENTE' });
});

test('descontarPedido: descuenta lo que controla stock e ignora el resto', async () => {
    const { estado, pool } = crearBd([camisa, servicio]);
    const r = await I.descontarPedido(pool, { negocioId: 1, pedidoId: 50, numeroPedido: 'AG-001-1', items: [{ producto_id: 1, cantidad: 2 }, { producto_id: 1, cantidad: 1 }, { producto_id: 3, cantidad: 4 }] });
    assert.deepStrictEqual(r, { ok: true });
    assert.strictEqual(estado.productos.get(1).stock, 2);       // 5 - (2+1)
    assert.strictEqual(estado.productos.get(3).stock, 0);       // servicio intacto
    assert.strictEqual(estado.movs.length, 1);
    assert.strictEqual(estado.movs[0].referencia_id, 50);
});

test('descontarPedido es todo o nada: si un producto no alcanza, no se descuenta ninguno', async () => {
    const { estado, pool } = crearBd([camisa, gorra]);
    const r = await I.descontarPedido(pool, { negocioId: 1, pedidoId: 51, items: [{ producto_id: 1, cantidad: 2 }, { producto_id: 2, cantidad: 3 }] });
    assert.strictEqual(r.ok, false);
    assert.deepStrictEqual(r.faltantes.map((f) => [f.nombre, f.disponible, f.pedido]), [['Gorra', 1, 3]]);
    assert.strictEqual(estado.productos.get(1).stock, 5);       // la camisa quedó como estaba
    assert.strictEqual(estado.movs.length, 0);
});

test('devolverPedido repone una sola vez (idempotente)', async () => {
    const { estado, pool } = crearBd([camisa]);
    await I.descontarPedido(pool, { negocioId: 1, pedidoId: 52, items: [{ producto_id: 1, cantidad: 4 }] });
    assert.strictEqual(estado.productos.get(1).stock, 1);
    assert.deepStrictEqual(await I.devolverPedido(pool, { negocioId: 1, pedidoId: 52 }), { devueltos: 1 });
    assert.strictEqual(estado.productos.get(1).stock, 5);
    assert.deepStrictEqual(await I.devolverPedido(pool, { negocioId: 1, pedidoId: 52 }), { devueltos: 0 });
    assert.strictEqual(estado.productos.get(1).stock, 5);
    // un pedido que nunca descontó nada no devuelve nada
    assert.deepStrictEqual(await I.devolverPedido(pool, { negocioId: 1, pedidoId: 999 }), { devueltos: 0 });
});

test('verificarDisponibilidad: avisa lo que falta y respeta productos sin control', async () => {
    const { pool } = crearBd([camisa, gorra, servicio]);
    const r = await I.verificarDisponibilidad(pool, 1, [{ producto_id: 1, cantidad: 2 }, { producto_id: 2, cantidad: 2 }, { producto_id: 3, cantidad: 50 }]);
    assert.strictEqual(r.ok, false);
    assert.deepStrictEqual(r.faltantes, [{ producto_id: 2, nombre: 'Gorra', disponible: 1, pedido: 2 }]);
    assert.strictEqual((await I.verificarDisponibilidad(pool, 1, [{ producto_id: 1, cantidad: 5 }])).ok, true);
    assert.strictEqual((await I.verificarDisponibilidad(pool, 1, [])).ok, true);
});

test('mensaje al cliente distingue agotado de pocas unidades', () => {
    const t = I.mensajeSinStock([{ nombre: 'Gorra', disponible: 1, pedido: 3 }, { nombre: 'Camisa', disponible: 0, pedido: 1 }]);
    assert.match(t, /Gorra: solo quedan 1 \(pediste 3\)/);
    assert.match(t, /Camisa: está agotado/);
});
