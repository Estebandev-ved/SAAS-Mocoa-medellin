const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const http = require('node:http');
const express = require('express');

// Rutas /api/productos con inventario, contra una base simulada en memoria (solo las consultas que usan estas rutas).
function crearBd(productos) {
    const estado = {
        productos: new Map(productos.map((p) => [p.id, { negocio_id: 1, activo: 1, controla_stock: 0, stock_minimo: null, sku: null, categoria: null, descripcion: null, ...p }])),
        movs: [], sig: 100,
    };
    let copia = null;
    const ejecutar = async (sql, p = []) => {
        const q = sql.replace(/\s+/g, ' ').trim();
        if (q.startsWith('SELECT * FROM productos WHERE negocio_id = ? AND activo = 1 ORDER BY nombre')) return [[...estado.productos.values()].filter((x) => x.negocio_id === p[0] && x.activo).sort((a, b) => a.nombre.localeCompare(b.nombre))];
        if (q.startsWith('SELECT id, nombre, sku, stock FROM productos WHERE negocio_id = ? AND activo = 1')) return [[...estado.productos.values()].filter((x) => x.negocio_id === p[0] && x.activo)];
        if (q.startsWith('SELECT COUNT(*) AS total FROM productos')) return [[{ total: [...estado.productos.values()].filter((x) => x.negocio_id === p[0]).length }]];
        if (q.startsWith('SELECT id, nombre, stock FROM productos WHERE id = ? AND negocio_id = ? FOR UPDATE')) {
            const f = estado.productos.get(Number(p[0]));
            return [f && f.negocio_id === p[1] ? [{ id: f.id, nombre: f.nombre, stock: f.stock }] : []];
        }
        if (q.startsWith('SELECT stock FROM productos WHERE id = ? AND negocio_id = ? FOR UPDATE')) {
            const f = estado.productos.get(Number(p[0]));
            return [f && f.negocio_id === p[1] ? [{ stock: f.stock }] : []];
        }
        if (q.startsWith('SELECT id, nombre, stock FROM productos WHERE id = ? AND negocio_id = ?')) {
            const f = estado.productos.get(Number(p[0]));
            return [f && f.negocio_id === p[1] ? [{ id: f.id, nombre: f.nombre, stock: f.stock }] : []];
        }
        if (q.startsWith('SELECT * FROM productos WHERE id = ?')) return [[estado.productos.get(Number(p[0]))].filter(Boolean)];
        if (q.startsWith('UPDATE productos SET stock = ?')) { estado.productos.get(Number(p[1])).stock = p[0]; return [{ affectedRows: 1 }]; }
        if (q.startsWith('UPDATE productos SET ') && q.endsWith('WHERE id = ? AND negocio_id = ?')) {
            const cols = q.slice('UPDATE productos SET '.length, q.indexOf(' WHERE')).split(', ').map((c) => c.replace(' = ?', ''));
            const id = Number(p[p.length - 2]);
            const f = estado.productos.get(id);
            if (!f || f.negocio_id !== p[p.length - 1]) return [{ affectedRows: 0 }];
            cols.forEach((c, i) => { f[c] = p[i]; });
            return [{ affectedRows: 1 }];
        }
        if (q.startsWith('INSERT INTO productos (negocio_id, nombre, sku,')) {
            const [negocio_id, nombre, sku, descripcion, precio, categoria, controla_stock, stock_minimo] = p;
            if (sku && [...estado.productos.values()].some((x) => x.negocio_id === negocio_id && x.sku === sku)) { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; }
            const id = estado.sig++;
            estado.productos.set(id, { id, negocio_id, nombre, sku, descripcion, precio, stock: 0, activo: 1, categoria, controla_stock, stock_minimo });
            return [{ insertId: id }];
        }
        if (q.startsWith('INSERT INTO productos (negocio_id, nombre, descripcion,')) {
            // Columnas en el orden del INSERT (las de inventario solo vienen si el formulario las mandó).
            const cols = q.slice(q.indexOf('(') + 1, q.indexOf(')')).split(', ');
            const fila = Object.fromEntries(cols.map((c, i) => [c, p[i]]));
            const id = estado.sig++;
            estado.productos.set(id, { id, activo: 1, controla_stock: 0, stock_minimo: null, sku: null, ...fila });
            return [{ insertId: id }];
        }
        if (q.startsWith('INSERT INTO inventario_movimientos')) {
            const [negocio_id, producto_id, tipo, cantidad, stock_resultante, motivo, referencia_tipo, referencia_id] = p;
            estado.movs.push({ id: estado.movs.length + 1, negocio_id, producto_id, tipo, cantidad, stock_resultante, motivo, referencia_tipo, referencia_id, created_at: 'hoy' });
            return [{}];
        }
        if (q.startsWith('SELECT id, tipo, cantidad, stock_resultante')) return [estado.movs.filter((m) => m.negocio_id === p[0] && m.producto_id === Number(p[1])).reverse().slice(0, Number(p[2]))];
        throw new Error(`Consulta no simulada: ${q.slice(0, 100)}`);
    };
    const bd = {
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
    return { estado, bd };
}

async function levantar(productos, plan = 'professional') {
    const { estado, bd } = crearBd(productos);
    const dbPath = require.resolve(path.join('..', '..', 'db', 'config'));
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: bd };
    const authPath = require.resolve('../../api/middleware/auth');
    require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { verificarAuth: (req, res, next) => { req.negocioId = 1; req.negocio = { id: 1, plan }; next(); } } };
    const tenantPath = require.resolve('../../api/middleware/tenant');
    require.cache[tenantPath] = { id: tenantPath, filename: tenantPath, loaded: true, exports: { checkProductLimit: (req, res, next) => next() } };
    for (const m of ['../../api/routes/products', '../../api/services/inventario']) delete require.cache[require.resolve(m)];
    const app = express();
    app.use(express.json());
    app.use('/api/productos', require('../../api/routes/products'));
    const servidor = await new Promise((r) => { const s = http.createServer(app).listen(0, () => r(s)); });
    const base = `http://127.0.0.1:${servidor.address().port}/api/productos`;
    const pedir = async (metodo, ruta, cuerpo) => {
        const r = await fetch(base + ruta, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
        const texto = await r.text();
        let json = null; try { json = JSON.parse(texto); } catch (_) { /* es CSV */ }
        return { estado: r.status, json, texto, cabeceras: r.headers };
    };
    const pedirBytes = async (ruta) => {
        const r = await fetch(base + ruta);
        return new Uint8Array(await r.arrayBuffer());
    };
    return { estado, pedir, pedirBytes, cerrar: () => new Promise((r) => servidor.close(r)) };
}

const camisa = { id: 1, nombre: 'Camisa', precio: 35000, stock: 5, controla_stock: 1, sku: 'CAM-1' };
const gorra = { id: 2, nombre: 'Gorra', precio: 25000, stock: 0, controla_stock: 0 };

test('PATCH stock: entrada y salida con historial; no baja de cero ni acepta cantidades raras', async () => {
    const s = await levantar([camisa]);
    try {
        let r = await s.pedir('PATCH', '/1/stock', { operacion: 'agregar', cantidad: 10, motivo: 'Compra a proveedor' });
        assert.deepStrictEqual([r.estado, r.json.stock_anterior, r.json.stock_nuevo], [200, 5, 15]);
        r = await s.pedir('PATCH', '/1/stock', { operacion: 'restar', cantidad: 3 });
        assert.strictEqual(r.json.stock_nuevo, 12);
        r = await s.pedir('PATCH', '/1/stock', { operacion: 'restar', cantidad: 99 });
        assert.deepStrictEqual([r.estado, r.json.error, r.json.stock_actual], [400, 'Stock insuficiente', 12]);
        for (const cantidad of [1.5, -2, 'abc']) assert.strictEqual((await s.pedir('PATCH', '/1/stock', { operacion: 'agregar', cantidad })).estado, 400);
        assert.strictEqual((await s.pedir('PATCH', '/999/stock', { operacion: 'agregar', cantidad: 1 })).estado, 404);
        assert.deepStrictEqual(s.estado.movs.map((m) => [m.tipo, m.cantidad, m.motivo]), [['entrada', 10, 'Compra a proveedor'], ['ajuste', -3, 'Salida manual']]);
        const h = await s.pedir('GET', '/1/movimientos');
        assert.strictEqual(h.json.movimientos.length, 2);
        assert.strictEqual(h.json.movimientos[0].stock_resultante, 12);   // el más reciente primero
        assert.strictEqual((await s.pedir('GET', '/999/movimientos')).estado, 404);
    } finally { await s.cerrar(); }
});

test('PUT: el stock se cambia con un ajuste con historial y valores inválidos se rechazan', async () => {
    const s = await levantar([camisa]);
    try {
        let r = await s.pedir('PUT', '/1', { stock: 8, stock_minimo: 2, sku: ' CAM-9 ', controla_stock: true });
        assert.strictEqual(r.estado, 200);
        assert.deepStrictEqual([s.estado.productos.get(1).stock, s.estado.productos.get(1).stock_minimo, s.estado.productos.get(1).sku], [8, 2, 'CAM-9']);
        assert.deepStrictEqual(s.estado.movs.map((m) => [m.tipo, m.cantidad, m.motivo]), [['ajuste', 3, 'Corrección manual']]);
        // mismo stock: no hay movimiento nuevo
        await s.pedir('PUT', '/1', { stock: 8 });
        assert.strictEqual(s.estado.movs.length, 1);
        for (const malo of [{ stock: -1 }, { stock: 2.5 }, { stock_minimo: -3 }, { sku: 'con espacios!' }, { controla_stock: 'quizás' }]) {
            assert.strictEqual((await s.pedir('PUT', '/1', malo)).estado, 400, JSON.stringify(malo));
        }
        assert.strictEqual(s.estado.productos.get(1).stock, 8);
    } finally { await s.cerrar(); }
});

test('POST: crea con inventario controlado y deja el stock inicial en el historial', async () => {
    const s = await levantar([]);
    try {
        const r = await s.pedir('POST', '/', { nombre: 'Zapatos', precio: 120000, stock: 7, controla_stock: true, stock_minimo: 2, sku: 'ZAP-1' });
        assert.strictEqual(r.estado, 201);
        const p = s.estado.productos.get(r.json.id);
        assert.deepStrictEqual([p.stock, p.controla_stock, p.stock_minimo, p.sku], [7, 1, 2, 'ZAP-1']);
        assert.deepStrictEqual(s.estado.movs.map((m) => [m.tipo, m.cantidad, m.motivo]), [['entrada', 7, 'Inventario inicial']]);
        assert.strictEqual((await s.pedir('POST', '/', { nombre: 'Otro', precio: 1, stock: -4 })).estado, 400);
    } finally { await s.cerrar(); }
});

test('exportar y reimportar el mismo archivo no cambia nada', async () => {
    const s = await levantar([camisa, gorra]);
    try {
        const exp = await s.pedir('GET', '/exportar');
        assert.strictEqual(exp.estado, 200);
        assert.match(exp.cabeceras.get('content-type'), /text\/csv/);
        const bytes = await s.pedirBytes('/exportar');
        assert.deepStrictEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF]);   // BOM UTF-8 para que Excel lea las tildes
        assert.ok(exp.texto.replace(/^﻿/, '').startsWith('nombre;sku;precio;stock'));
        assert.ok(exp.texto.includes('Camisa;CAM-1;35000;5'));
        const antes = JSON.stringify([...s.estado.productos.values()]);
        const vista = await s.pedir('POST', '/importar', { csv: exp.texto });
        assert.deepStrictEqual([vista.json.aplicado, vista.json.resumen.errores, vista.json.resumen.actualizar, vista.json.resumen.crear], [false, 0, 2, 0]);
        const aplicado = await s.pedir('POST', '/importar', { csv: exp.texto, aplicar: true });
        assert.deepStrictEqual([aplicado.json.creados, aplicado.json.actualizados, aplicado.json.errores.length], [0, 2, 0]);
        assert.strictEqual(JSON.stringify([...s.estado.productos.values()]), antes);
        assert.strictEqual(s.estado.movs.length, 0);
    } finally { await s.cerrar(); }
});

test('importar: la vista previa no guarda; aplicar crea, ajusta stock con historial y reporta errores por fila', async () => {
    const s = await levantar([camisa]);
    try {
        const csv = ['nombre;sku;precio;stock', 'Camisa;CAM-1;40.000;12', 'Bufanda;BUF-1;15.000;30', 'Sin precio;;;1', 'Medias;MED-1;5000;-4'].join('\n');
        const vista = await s.pedir('POST', '/importar', { csv });
        assert.deepStrictEqual(vista.json.resumen, { crear: 1, actualizar: 1, errores: 2, total: 4 });
        assert.strictEqual(s.estado.productos.size, 1);   // nada se guardó
        const r = await s.pedir('POST', '/importar', { csv, aplicar: true });
        assert.deepStrictEqual([r.json.creados, r.json.actualizados], [1, 1]);
        assert.deepStrictEqual(r.json.errores.map((e) => e.numero), [4, 5]);
        assert.strictEqual(s.estado.productos.get(1).stock, 12);
        assert.strictEqual(s.estado.productos.get(1).precio, 40000);
        const nuevo = [...s.estado.productos.values()].find((p) => p.nombre === 'Bufanda');
        assert.deepStrictEqual([nuevo.stock, nuevo.controla_stock], [30, 1]);   // trae stock → controla inventario
        const resumen = s.estado.movs.map((m) => `${m.producto_id === 1 ? 'camisa' : 'bufanda'}:${m.tipo}:${m.cantidad}`).sort();
        assert.deepStrictEqual(resumen, ['bufanda:entrada:30', 'camisa:ajuste:7']);
    } finally { await s.cerrar(); }
});

test('importar: rechaza archivos inválidos y respeta el límite del plan', async () => {
    const s = await levantar([camisa]);
    try {
        assert.strictEqual((await s.pedir('POST', '/importar', { csv: 'precio;stock\n1;2' })).estado, 400);
        assert.strictEqual((await s.pedir('POST', '/importar', {})).estado, 400);
        // plan emprendedor: maxProducts 0 → -1 ilimitado o tope; se prueba con un plan que sí tenga tope
        const { PLANS } = require('../../config/planConfig');
        const conTope = Object.values(PLANS).find((p) => p.features.maxProducts > 0 && p.features.maxProducts < 100000);
        if (conTope) {
            const filas = ['nombre;precio', ...Array.from({ length: conTope.features.maxProducts + 1 }, (_, i) => `Prod ${i};100`)];
            if (filas.length - 1 <= 500) {
                const s2 = await levantar([camisa], conTope.id);
                try {
                    const r = await s2.pedir('POST', '/importar', { csv: filas.join('\n') });
                    assert.deepStrictEqual([r.estado, r.json.codigo], [403, 'LIMITE_PRODUCTOS']);
                } finally { await s2.cerrar(); }
            }
        }
    } finally { await s.cerrar(); }
});
