const test = require('node:test');
const assert = require('node:assert');
const V = require('../../api/services/ventasMostrador');

// Base simulada con transacciones (rollback restaura una copia del estado).
function crearBd() {
    const s = {
        productos: new Map([
            [1, { id: 1, nombre: 'Camisa', precio: '50000.00', stock: 5, controla_stock: 1, activo: 1 }],
            [2, { id: 2, nombre: 'Corte de pelo', precio: '20000.00', stock: 0, controla_stock: 0, activo: 1 }],
            [3, { id: 3, nombre: 'Descontinuado', precio: '1000.00', stock: 9, controla_stock: 1, activo: 0 }],
        ]),
        ventas: [], items: [], movs: [], turnos: [], gastos: [],
    };
    const q = (sql) => sql.replace(/\s+/g, ' ').trim();
    async function execute(sql, p = []) {
        const t = q(sql);
        if (t.startsWith('SELECT id, nombre, precio, controla_stock FROM productos')) {
            const [neg, ...ids] = p;
            return [[...s.productos.values()].filter((x) => ids.includes(x.id) && x.activo).sort((a, b) => a.id - b.id)];
        }
        if (t.startsWith('SELECT id, nombre, stock FROM productos WHERE id = ?')) { const x = s.productos.get(p[0]); return [x ? [{ id: x.id, nombre: x.nombre, stock: x.stock }] : []]; }
        if (t.startsWith('UPDATE productos SET stock = ?')) { s.productos.get(p[1]).stock = p[0]; return [{}]; }
        if (t.startsWith('INSERT INTO inventario_movimientos')) { s.movs.push({ producto_id: p[1], tipo: p[2], cantidad: p[3], referencia_tipo: p[6], referencia_id: p[7] }); return [{}]; }
        if (t.startsWith('SELECT id FROM caja_turnos')) { const a = s.turnos.filter((x) => !x.cerrado); return [a.length ? [{ id: a[a.length - 1].id }] : []]; }
        if (t.startsWith('SELECT * FROM caja_turnos')) { const a = s.turnos.filter((x) => !x.cerrado); return [a.length ? [a[a.length - 1]] : []]; }
        if (t.startsWith('INSERT INTO ventas_mostrador (')) { const id = s.ventas.length + 1; s.ventas.push({ id, turno_id: p[1], total: p[2], metodo_pago: p[3], recibido: p[4], estado: 'pagada' }); return [{ insertId: id }]; }
        if (t.startsWith('UPDATE ventas_mostrador SET numero')) { s.ventas.find((v) => v.id === p[1]).numero = p[0]; return [{}]; }
        if (t.startsWith('INSERT INTO ventas_mostrador_items')) { s.items.push({ venta_id: p[0], producto_id: p[1], cantidad: p[3] }); return [{}]; }
        if (t.startsWith('SELECT id, numero, estado FROM ventas_mostrador')) { const v = s.ventas.find((x) => x.id === p[0]); return [v ? [v] : []]; }
        if (t.startsWith('SELECT i.producto_id, i.cantidad FROM ventas_mostrador_items')) {
            return [s.items.filter((i) => i.venta_id === p[1] && s.productos.get(i.producto_id).controla_stock)];
        }
        if (t.startsWith("UPDATE ventas_mostrador SET estado = 'anulada'")) { s.ventas.find((v) => v.id === p[0]).estado = 'anulada'; return [{}]; }
        if (t.startsWith('SELECT metodo_pago, COUNT(*)')) {
            const por = {};
            for (const v of s.ventas.filter((x) => x.turno_id === p[1] && x.estado === 'pagada')) { por[v.metodo_pago] = por[v.metodo_pago] || { metodo_pago: v.metodo_pago, ventas: 0, total: 0 }; por[v.metodo_pago].ventas++; por[v.metodo_pago].total += v.total; }
            return [Object.values(por)];
        }
        if (t.startsWith('SELECT SUM(monto)')) { const g = s.gastos.filter((x) => x.turno_id === p[1]); return [[{ total: g.reduce((a, x) => a + x.monto, 0) || null, cantidad: g.length }]]; }
        throw new Error('consulta no prevista: ' + t);
    }
    const pool = {
        execute,
        async getConnection() {
            let copia;
            return {
                execute,
                async beginTransaction() { copia = JSON.stringify({ ...s, productos: [...s.productos] }); },
                async commit() {},
                async rollback() { const c = JSON.parse(copia); s.productos = new Map(c.productos); for (const k of ['ventas', 'items', 'movs']) s[k] = c[k]; },
                release() {},
            };
        },
    };
    return { s, pool };
}

test('validarVenta: junta repetidos, exige productos y cantidades enteras, y acota método y monto', () => {
    const ok = V.validarVenta({ items: [{ producto_id: 1, cantidad: 2 }, { producto_id: 1, cantidad: 1 }], metodo_pago: 'nequi' });
    assert.deepStrictEqual(ok.datos.items, [{ producto_id: 1, cantidad: 3 }]);
    assert.strictEqual(V.validarVenta({ items: [{ producto_id: 1, cantidad: 1 }] }).datos.metodo_pago, 'efectivo');
    for (const mal of [{}, { items: [] }, { items: [{ producto_id: 1, cantidad: 0 }] }, { items: [{ producto_id: 1, cantidad: 1.5 }] },
        { items: [{ producto_id: 'x', cantidad: 1 }] }, { items: [{ producto_id: 1, cantidad: 1 }], metodo_pago: 'bitcoin' },
        { items: [{ producto_id: 1, cantidad: 1 }], recibido: -5 }]) {
        assert.ok(V.validarVenta(mal).error, JSON.stringify(mal));
    }
});

test('crearVenta: el precio sale de la base, descuenta stock solo de los productos que lo controlan y calcula el cambio', async () => {
    const { s, pool } = crearBd();
    const v = V.validarVenta({ items: [{ producto_id: 1, cantidad: 2, precio: 1 }, { producto_id: 2, cantidad: 1 }], metodo_pago: 'efectivo', recibido: 200000 });
    const r = await V.crearVenta(pool, 7, v.datos);
    assert.strictEqual(r.total, 120000);            // 2 x 50.000 + 20.000; el "precio: 1" del navegador se ignora
    assert.strictEqual(r.cambio, 80000);
    assert.match(r.numero, /^M-\d{8}-000001$/);
    assert.strictEqual(s.productos.get(1).stock, 3);
    assert.strictEqual(s.productos.get(2).stock, 0); // el servicio no controla stock
    assert.deepStrictEqual(s.movs.map((m) => [m.producto_id, m.tipo, m.cantidad, m.referencia_tipo]), [[1, 'salida', -2, 'mostrador']]);
});

test('crearVenta: si un producto no alcanza no se registra nada; productos inactivos y efectivo insuficiente se rechazan', async () => {
    const { s, pool } = crearBd();
    await assert.rejects(V.crearVenta(pool, 7, V.validarVenta({ items: [{ producto_id: 2, cantidad: 1 }, { producto_id: 1, cantidad: 9 }] }).datos), (e) => e.codigo === 'STOCK_INSUFICIENTE');
    assert.strictEqual(s.ventas.length, 0);
    assert.strictEqual(s.productos.get(1).stock, 5);
    await assert.rejects(V.crearVenta(pool, 7, V.validarVenta({ items: [{ producto_id: 3, cantidad: 1 }] }).datos), (e) => e.codigo === 'PRODUCTO_NO_ENCONTRADO');
    await assert.rejects(V.crearVenta(pool, 7, V.validarVenta({ items: [{ producto_id: 2, cantidad: 1 }], recibido: 5000 }).datos), (e) => e.codigo === 'RECIBIDO_INSUFICIENTE');
});

test('anularVenta: devuelve el stock una sola vez', async () => {
    const { s, pool } = crearBd();
    const r = await V.crearVenta(pool, 7, V.validarVenta({ items: [{ producto_id: 1, cantidad: 4 }] }).datos);
    assert.strictEqual(s.productos.get(1).stock, 1);
    const a = await V.anularVenta(pool, 7, r.id);
    assert.strictEqual(a.stock_devuelto, 1);
    assert.strictEqual(s.productos.get(1).stock, 5);
    await assert.rejects(V.anularVenta(pool, 7, r.id), (e) => e.codigo === 'YA_ANULADA');
    await assert.rejects(V.anularVenta(pool, 7, 999), (e) => e.codigo === 'VENTA_NO_ENCONTRADA');
    assert.strictEqual(s.productos.get(1).stock, 5);
});

test('turno: las ventas quedan en el turno abierto y el efectivo esperado = inicial + efectivo − gastos', async () => {
    const { s, pool } = crearBd();
    s.turnos.push({ id: 10, negocio_id: 7, monto_inicial: '50000.00', abierto_en: new Date(), cerrado: false });
    await V.crearVenta(pool, 7, V.validarVenta({ items: [{ producto_id: 2, cantidad: 2 }], metodo_pago: 'efectivo' }).datos);   // 40.000 efectivo
    await V.crearVenta(pool, 7, V.validarVenta({ items: [{ producto_id: 1, cantidad: 1 }], metodo_pago: 'nequi' }).datos);      // 50.000 nequi
    s.gastos.push({ turno_id: 10, monto: 15000 });
    const turno = await V.turnoAbierto(pool, 7);
    const r = await V.resumenTurno(pool, 7, turno);
    assert.strictEqual(r.ventas, 2);
    assert.strictEqual(r.total_ventas, 90000);
    assert.deepStrictEqual(r.por_metodo.nequi, { ventas: 1, total: 50000 });
    assert.strictEqual(r.gastos, 15000);
    assert.strictEqual(r.efectivo_esperado, 75000);   // 50.000 + 40.000 − 15.000
});

test('validarMonto: acepta decimales razonables y rechaza negativos o enormes', () => {
    assert.strictEqual(V.validarMonto('1500.5').monto, 1500.5);
    assert.strictEqual(V.validarMonto(0).monto, 0);
    assert.ok(V.validarMonto(0, { permitirCero: false }).error);
    for (const mal of [-1, 'abc', 1e12, undefined]) assert.ok(V.validarMonto(mal).error, String(mal));
});
