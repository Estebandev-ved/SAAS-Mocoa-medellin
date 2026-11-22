const test = require('node:test');
const assert = require('node:assert');
const V = require('../../api/services/ventasMostrador');

// Base simulada con transacciones (rollback restaura una copia del estado).
function crearBd() {
    const s = {
        productos: new Map([
            [1, { id: 1, nombre: 'Camisa', precio: '50000.00', costo: '30000.00', stock: 5, controla_stock: 1, activo: 1 }],
            [2, { id: 2, nombre: 'Corte de pelo', precio: '20000.00', costo: null, stock: 0, controla_stock: 0, activo: 1 }],
            [3, { id: 3, nombre: 'Descontinuado', precio: '1000.00', costo: null, stock: 9, controla_stock: 1, activo: 0 }],
        ]),
        ventas: [], items: [], movs: [], turnos: [], gastos: [],
        clientes: [{ id: 1, negocio_id: 7, nombre: 'Laura', telefono: '573001112233' }, { id: 2, negocio_id: 99, nombre: 'De otro negocio', telefono: null }],
        fm: [],   // movimientos de fiado
    };
    const saldoFiado = (cid) => s.fm.filter((m) => m.cliente_id === cid && !m.anulado).reduce((a, m) => a + (m.tipo === 'cargo' ? m.monto : -m.monto), 0);
    const q = (sql) => sql.replace(/\s+/g, ' ').trim();
    async function execute(sql, p = []) {
        const t = q(sql);
        if (t.startsWith('SELECT id, nombre, precio, costo, controla_stock FROM productos')) {
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
        if (t.startsWith('INSERT INTO ventas_mostrador_items')) { s.items.push({ venta_id: p[0], producto_id: p[1], nombre: p[2], cantidad: p[3], precio_unitario: p[4], costo_unitario: p[5] }); return [{}]; }
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
        // ¿Cuánto gané?: calcula con los items y gastos simulados (no filtra por fecha: todo cuenta como del período).
        if (t.startsWith('SELECT COUNT(DISTINCT v.id) AS ventas')) {
            const pagadas = s.ventas.filter((v) => v.estado === 'pagada');
            const its = s.items.filter((i) => pagadas.some((v) => v.id === i.venta_id));
            const suma = (f) => its.reduce((a, i) => a + f(i), 0);
            const conCosto = (i) => i.costo_unitario !== null && i.costo_unitario !== undefined;
            return [[{
                ventas: new Set(its.map((i) => i.venta_id)).size,
                ingresos: suma((i) => i.cantidad * i.precio_unitario),
                costo: suma((i) => (conCosto(i) ? i.cantidad * i.costo_unitario : 0)),
                ingresos_con_costo: suma((i) => (conCosto(i) ? i.cantidad * i.precio_unitario : 0)),
                ventas_sin_costo: suma((i) => (conCosto(i) ? 0 : i.cantidad * i.precio_unitario)),
            }]];
        }
        // ---- fiado ----
        if (t.startsWith('SELECT id FROM fiado_clientes')) { const c = s.clientes.find((x) => x.id === p[0] && x.negocio_id === p[1]); return [c ? [{ id: c.id }] : []]; }
        if (t.startsWith('INSERT INTO fiado_movimientos')) {
            const cargo = t.includes("'cargo'");
            s.fm.push(cargo
                ? { negocio_id: p[0], cliente_id: p[1], tipo: 'cargo', monto: p[2], venta_id: p[3], turno_id: p[4], metodo_pago: null, anulado: 0 }
                : { negocio_id: p[0], cliente_id: p[1], tipo: 'abono', monto: p[2], venta_id: null, turno_id: p[3], metodo_pago: p[4], anulado: 0 });
            return [{}];
        }
        if (t.startsWith('SELECT COALESCE(SUM(CASE WHEN tipo')) return [[{ saldo: saldoFiado(p[1]) }]];
        if (t.startsWith('UPDATE fiado_movimientos SET anulado = 1')) { s.fm.filter((m) => m.venta_id === p[1] && m.tipo === 'cargo').forEach((m) => { m.anulado = 1; }); return [{}]; }
        if (t.startsWith('SELECT SUM(monto) AS total FROM fiado_movimientos')) {
            return [[{ total: s.fm.filter((m) => m.turno_id === p[1] && m.tipo === 'abono' && m.metodo_pago === 'efectivo' && !m.anulado).reduce((a, m) => a + m.monto, 0) || null }]];
        }
        if (t.startsWith('SELECT COUNT(*) AS total FROM fiado_clientes')) return [[{ total: s.clientes.filter((c) => c.negocio_id === p[0]).length }]];
        if (t.startsWith('INSERT INTO fiado_clientes')) {
            if (s.clientes.some((c) => c.negocio_id === p[0] && c.nombre.toLowerCase() === p[1].toLowerCase())) throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
            const id = s.clientes.length + 1; s.clientes.push({ id, negocio_id: p[0], nombre: p[1], telefono: p[2] }); return [{ insertId: id }];
        }
        if (t.startsWith('SELECT c.id, c.nombre, c.telefono')) {
            return [s.clientes.filter((c) => c.negocio_id === p[0]).map((c) => ({ ...c, saldo: saldoFiado(c.id), ultimo_movimiento: null })).sort((a, b) => b.saldo - a.saldo)];
        }
        if (t.startsWith('SELECT SUM(monto) AS total FROM caja_gastos')) return [[{ total: s.gastos.reduce((a, x) => a + x.monto, 0) || null }]];
        if (t.startsWith('SELECT i.nombre, SUM(i.cantidad)')) {
            const por = new Map();
            for (const i of s.items.filter((x) => x.costo_unitario !== null && x.costo_unitario !== undefined && s.ventas.find((v) => v.id === x.venta_id).estado === 'pagada')) {
                const a = por.get(i.nombre) || { nombre: i.nombre, unidades: 0, ganancia: 0 };
                a.unidades += i.cantidad; a.ganancia += i.cantidad * (i.precio_unitario - i.costo_unitario);
                por.set(i.nombre, a);
            }
            return [[...por.values()].sort((a, b) => b.ganancia - a.ganancia)];
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
                async rollback() { const c = JSON.parse(copia); s.productos = new Map(c.productos); for (const k of ['ventas', 'items', 'movs', 'fm']) s[k] = c[k]; },
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

test('crearVenta: copia el costo del producto a la venta (NULL si no tiene) y no cambia si luego se edita', async () => {
    const { s, pool } = crearBd();
    await V.crearVenta(pool, 7, V.validarVenta({ items: [{ producto_id: 1, cantidad: 2 }, { producto_id: 2, cantidad: 1 }] }).datos);
    assert.deepStrictEqual(s.items.map((i) => [i.producto_id, i.costo_unitario]), [[1, 30000], [2, null]]);
    s.productos.get(1).costo = '45000.00';   // el dueño sube el costo después: lo ya vendido conserva el de entonces
    assert.strictEqual(s.items[0].costo_unitario, 30000);
});

test('resumenGanancia: ganancia = lo vendido con costo − su costo − gastos; lo sin costo se cuenta aparte', async () => {
    const { s, pool } = crearBd();
    await V.crearVenta(pool, 7, V.validarVenta({ items: [{ producto_id: 1, cantidad: 2 }] }).datos);   // vende 100.000, costó 60.000
    await V.crearVenta(pool, 7, V.validarVenta({ items: [{ producto_id: 2, cantidad: 1 }] }).datos);   // 20.000 sin costo anotado
    s.gastos.push({ turno_id: null, monto: 5000 });
    const r = await V.resumenGanancia(pool, 7, 'hoy');
    assert.strictEqual(r.ventas, 2);
    assert.strictEqual(r.ingresos, 120000);
    assert.strictEqual(r.costo, 60000);
    assert.strictEqual(r.ganancia_bruta, 40000);      // solo de lo que tiene costo: 100.000 − 60.000
    assert.strictEqual(r.ganancia_neta, 35000);       // − 5.000 de gastos
    assert.strictEqual(r.ventas_sin_costo, 20000);
    assert.strictEqual(r.completo, false);
    assert.strictEqual(r.margen, 40);                 // 40.000 / 100.000
    assert.deepStrictEqual(r.mejores, [{ nombre: 'Camisa', unidades: 2, ganancia: 40000 }]);
});

test('resumenGanancia: una venta anulada no cuenta, y un período desconocido cae en "hoy"', async () => {
    const { pool } = crearBd();
    const v = await V.crearVenta(pool, 7, V.validarVenta({ items: [{ producto_id: 1, cantidad: 1 }] }).datos);
    await V.anularVenta(pool, 7, v.id);
    const r = await V.resumenGanancia(pool, 7, 'siglo; DROP TABLE x');
    assert.strictEqual(r.periodo, 'hoy');
    assert.deepStrictEqual([r.ventas, r.ingresos, r.ganancia_neta, r.completo, r.margen], [0, 0, 0, true, null]);
    assert.deepStrictEqual(Object.keys(V.PERIODOS), ['hoy', 'semana', 'mes']);
});

const FIADO = require('../../api/services/fiado');

test('fiado: vender fiado exige cliente, deja la deuda y no mueve la plata del turno; anular la quita', async () => {
    const { s, pool } = crearBd();
    assert.ok(V.validarVenta({ items: [{ producto_id: 2, cantidad: 1 }], metodo_pago: 'fiado' }).error, 'sin cliente no se puede fiar');
    s.turnos.push({ id: 10, negocio_id: 7, monto_inicial: '50000.00', abierto_en: new Date(), cerrado: false });

    const v = await V.crearVenta(pool, 7, V.validarVenta({ items: [{ producto_id: 2, cantidad: 2 }], metodo_pago: 'fiado', cliente_id: 1 }).datos);   // 40.000 fiados
    assert.strictEqual(v.total, 40000);
    assert.strictEqual((await FIADO.listarClientes(pool, 7)).total_por_cobrar, 40000);
    const turno = await V.resumenTurno(pool, 7, await V.turnoAbierto(pool, 7));
    assert.strictEqual(turno.efectivo_esperado, 50000);          // lo fiado NO entró a la caja
    assert.strictEqual(turno.por_metodo.fiado.total, 40000);     // pero sí cuenta como venta

    await V.anularVenta(pool, 7, v.id);
    assert.strictEqual((await FIADO.listarClientes(pool, 7)).total_por_cobrar, 0);
});

test('fiado: no se puede fiar a un cliente de otro negocio ni inexistente, y la venta no queda a medias', async () => {
    const { s, pool } = crearBd();
    for (const cliente_id of [2, 999]) {
        await assert.rejects(V.crearVenta(pool, 7, V.validarVenta({ items: [{ producto_id: 1, cantidad: 1 }], metodo_pago: 'fiado', cliente_id }).datos), (e) => e.codigo === 'CLIENTE_NO_ENCONTRADO');
    }
    assert.strictEqual(s.ventas.length, 0);
    assert.strictEqual(s.productos.get(1).stock, 5);   // el stock se devolvió con el rollback
});

test('fiado: los abonos bajan el saldo, no pueden pasar de lo que debe y los de efectivo cuentan en el arqueo', async () => {
    const { s, pool } = crearBd();
    s.turnos.push({ id: 10, negocio_id: 7, monto_inicial: '0.00', abierto_en: new Date(), cerrado: false });
    await V.crearVenta(pool, 7, V.validarVenta({ items: [{ producto_id: 1, cantidad: 2 }], metodo_pago: 'fiado', cliente_id: 1 }).datos);   // debe 100.000

    const a = await FIADO.registrarAbono(pool, 7, 1, { monto: 30000, metodo_pago: 'efectivo' });
    assert.deepStrictEqual(a, { saldo_anterior: 100000, saldo: 70000 });
    await FIADO.registrarAbono(pool, 7, 1, { monto: 20000, metodo_pago: 'nequi' });
    assert.strictEqual((await FIADO.listarClientes(pool, 7)).clientes.find((c) => c.id === 1).saldo, 50000);
    const turno = await V.resumenTurno(pool, 7, await V.turnoAbierto(pool, 7));
    assert.strictEqual(turno.efectivo_esperado, 30000);          // solo el abono en efectivo entra a la caja; el Nequi no

    await assert.rejects(FIADO.registrarAbono(pool, 7, 1, { monto: 50001 }), (e) => e.codigo === 'ABONO_MAYOR' && e.detalle.saldo === 50000);
    await FIADO.registrarAbono(pool, 7, 1, { monto: 50000 });
    await assert.rejects(FIADO.registrarAbono(pool, 7, 1, { monto: 1 }), (e) => e.codigo === 'ABONO_MAYOR');
    for (const mal of [{ monto: 0 }, { monto: -5 }, { monto: 'x' }, { monto: 10, metodo_pago: 'fiado' }]) {
        await assert.rejects(FIADO.registrarAbono(pool, 7, 1, mal), (e) => e.codigo === 'ABONO_INVALIDO', JSON.stringify(mal));
    }
    await assert.rejects(FIADO.registrarAbono(pool, 7, 2, { monto: 1 }), (e) => e.codigo === 'CLIENTE_NO_ENCONTRADO');   // de otro negocio
    await assert.rejects(FIADO.registrarAbono(pool, 7, NaN, { monto: 1 }), (e) => e.codigo === 'CLIENTE_NO_ENCONTRADO');
});

test('fiado: clientes — nombre obligatorio, celular colombiano normalizado y sin repetir nombre', async () => {
    const { pool } = crearBd();
    assert.strictEqual(FIADO.normalizarTelefono('300 123 4567').telefono, '573001234567');
    assert.strictEqual(FIADO.normalizarTelefono('+57 300 123 4567').telefono, '573001234567');
    assert.strictEqual(FIADO.normalizarTelefono('').telefono, null);
    assert.ok(FIADO.normalizarTelefono('12345').error);
    const c = await FIADO.crearCliente(pool, 7, { nombre: '  Pedro   Pérez ', telefono: '3109998877' });
    assert.deepStrictEqual([c.nombre, c.telefono, c.saldo], ['Pedro Pérez', '573109998877', 0]);
    await assert.rejects(FIADO.crearCliente(pool, 7, { nombre: 'pedro pérez' }), (e) => e.codigo === 'CLIENTE_REPETIDO');
    await assert.rejects(FIADO.crearCliente(pool, 7, { nombre: '   ' }), (e) => e.codigo === 'CLIENTE_INVALIDO');
    await assert.rejects(FIADO.crearCliente(pool, 7, { nombre: 'Ana', telefono: 'abc' }), (e) => e.codigo === 'CLIENTE_INVALIDO');
});

test('validarMonto: acepta decimales razonables y rechaza negativos o enormes', () => {
    assert.strictEqual(V.validarMonto('1500.5').monto, 1500.5);
    assert.strictEqual(V.validarMonto(0).monto, 0);
    assert.ok(V.validarMonto(0, { permitirCero: false }).error);
    for (const mal of [-1, 'abc', 1e12, undefined]) assert.ok(V.validarMonto(mal).error, String(mal));
});
