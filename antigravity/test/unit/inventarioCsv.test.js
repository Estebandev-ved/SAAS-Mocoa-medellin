const test = require('node:test');
const assert = require('node:assert');
const C = require('../../api/services/inventarioCsv');

test('parsear: separador ; o , con BOM, comillas, saltos de línea y filas vacías', () => {
    assert.deepStrictEqual(C.parsearCsv('﻿nombre;precio\r\nCamisa;35000\r\n\r\n"Gorra; negra";"25""000"\n'),
        [['nombre', 'precio'], ['Camisa', '35000'], ['Gorra; negra', '25"000']]);
    assert.deepStrictEqual(C.parsearCsv('nombre,precio\nA,1'), [['nombre', 'precio'], ['A', '1']]);
    assert.deepStrictEqual(C.parsearCsv('nombre;nota\n"línea 1\nlínea 2";x'), [['nombre', 'nota'], ['línea 1\nlínea 2', 'x']]);
    assert.deepStrictEqual(C.parsearCsv('   '), []);
});

test('generar: ; con BOM, comillas y protección contra fórmulas', () => {
    const csv = C.generarCsv([['nombre', 'nota'], ['Gorra; negra', '=1+1'], ['Ana', '-5'], ['Luis', null]]);
    assert.ok(csv.startsWith('﻿nombre;nota\r\n'));
    assert.ok(csv.includes('"Gorra; negra";\'=1+1'));
    assert.ok(csv.includes('Ana;-5'));           // un número negativo no se toca
    assert.ok(csv.includes('Luis;\r\n'));
    // ida y vuelta
    assert.deepStrictEqual(C.parsearCsv(C.generarCsv([['a', 'b;c'], ['"x"', 'y']])), [['a', 'b;c'], ['"x"', 'y']]);
});

test('números en formato colombiano', () => {
    assert.strictEqual(C.parsearNumero('12.500'), 12500);
    assert.strictEqual(C.parsearNumero('$ 12.500,50'), 12500.5);
    assert.strictEqual(C.parsearNumero('12500'), 12500);
    assert.strictEqual(C.parsearNumero('3,5'), 3.5);
    assert.strictEqual(C.parsearNumero('abc'), null);
    assert.strictEqual(C.parsearNumero(''), null);
});

const existentes = [{ id: 1, nombre: 'Camisa Básica', sku: 'CAM-1', stock: 5 }, { id: 2, nombre: 'Gorra', sku: null, stock: 0 }];

test('analizar: crea, actualiza por SKU o por nombre sin tildes, y señala errores por fila', () => {
    const csv = [
        'Producto;Código;Precio;Cantidad;Mínimo;Categoría',
        'Camisa nueva talla;CAM-1;40.000;12;3;Ropa',   // actualiza por SKU (aunque el nombre cambie)
        'gorra;;26000;;;',                              // actualiza por nombre
        'Zapatos;ZAP-1;120.000;8;;Calzado',             // crea; trae stock → controla
        ';X1;1000;1;;',                                 // sin nombre
        'Medias;;abc;1;;',                              // precio inválido
        'Bolso;;50000;-2;;',                            // stock inválido
        'Zapatos;;1;1;;',                               // repetido en el archivo
    ].join('\n');
    const r = C.analizarCsv(csv, existentes);
    assert.deepStrictEqual(r.resumen, { crear: 1, actualizar: 2, errores: 4, total: 7 });
    const [a, b, c, d, e, f, g] = r.filas;
    assert.deepStrictEqual([a.accion, a.producto_id, a.datos.stock, a.datos.stock_minimo, a.stock_actual], ['actualizar', 1, 12, 3, 5]);
    assert.deepStrictEqual([b.accion, b.producto_id, b.datos.precio, b.datos.stock], ['actualizar', 2, 26000, undefined]);
    assert.deepStrictEqual([c.accion, c.datos.controla_stock, c.datos.precio], ['crear', true, 120000]);
    assert.match(d.error, /nombre/);
    assert.match(e.error, /precio/);
    assert.match(f.error, /stock/);
    assert.match(g.error, /repetido/);
    assert.strictEqual(d.numero, 5);  // número de fila como en Excel
});

test('analizar: validaciones del archivo', () => {
    assert.match(C.analizarCsv('precio;stock\n1;2', []).error, /nombre/);
    assert.match(C.analizarCsv('nombre;precio', []).error, /al menos un producto/);
    assert.match(C.analizarCsv('x'.repeat(1024 * 1024 + 1), []).error, /grande/);
    const muchas = ['nombre;precio', ...Array.from({ length: 501 }, (_, i) => `P${i};1`)].join('\n');
    assert.match(C.analizarCsv(muchas, []).error, /Máximo 500/);
    assert.match(C.analizarCsv('nombre;precio;controla_stock\nA;1;quizás', []).filas[0].error, /si o no/);
    assert.strictEqual(C.analizarCsv('nombre;precio\nA;1', []).filas[0].datos.controla_stock, undefined); // sin stock: no se activa solo
});
