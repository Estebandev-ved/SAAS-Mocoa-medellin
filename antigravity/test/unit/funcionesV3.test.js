const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const raiz = path.join(__dirname, '..', '..');
const dbPath = require.resolve(path.join(raiz, 'db', 'config'));

// La base se simula: estas pruebas no necesitan MySQL.
let respuestas = [];
require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: { execute: async () => respuestas.shift() },
};

const cupones = require('../../api/services/cupones');
const { pideHumano } = require('../../instance-manager/handlers/atencionHumana');
const { parseCalificacion, registrarRespuesta } = require('../../instance-manager/handlers/encuesta');
const { productosMencionados } = require('../../instance-manager/handlers/fotos');

// ---------- Cupones ----------
const base = { activo: 1, tipo: 'porcentaje', valor: 10, minimo_compra: 0, usos_max: null, usos: 0, vence_el: null };

test('descuento por porcentaje y fijo, sin pasar del subtotal', () => {
    assert.equal(cupones.calcularDescuento(base, 50000), 5000);
    assert.equal(cupones.calcularDescuento({ ...base, tipo: 'fijo', valor: 8000 }, 50000), 8000);
    assert.equal(cupones.calcularDescuento({ ...base, tipo: 'fijo', valor: 99999 }, 20000), 20000);
    assert.equal(cupones.calcularDescuento({ ...base, valor: 250 }, 1000), 1000); // % > 100 se limita
});

test('un cupón vencido, agotado, inactivo o bajo el mínimo no aplica', () => {
    assert.equal(cupones.validarCupon(base, 1000).ok, true);
    assert.equal(cupones.validarCupon({ ...base, activo: 0 }, 1000).motivo, 'inactivo');
    assert.equal(cupones.validarCupon({ ...base, vence_el: '2020-01-01' }, 1000).motivo, 'vencido');
    assert.equal(cupones.validarCupon({ ...base, usos_max: 5, usos: 5 }, 1000).motivo, 'agotado');
    assert.equal(cupones.validarCupon({ ...base, minimo_compra: 30000 }, 20000).motivo, 'minimo');
    assert.equal(cupones.validarCupon({ ...base, vence_el: '2099-12-31' }, 1000).ok, true);
});

test('el cupón que vence hoy todavía sirve hoy', () => {
    const hoy = new Date('2026-10-11T20:00:00');
    assert.equal(cupones.validarCupon({ ...base, vence_el: '2026-10-11' }, 1000, hoy).ok, true);
    assert.equal(cupones.validarCupon({ ...base, vence_el: '2026-10-10' }, 1000, hoy).ok, false);
});

test('normalizarCodigo limpia espacios, acentos y símbolos', () => {
    assert.equal(cupones.normalizarCodigo(' verano-20% '), 'VERANO-20');
    assert.equal(cupones.normalizarCodigo('Ñandú'), 'NANDU');
});

test('buscarEnTextos encuentra el código escrito por el cliente (sin importar mayúsculas)', async () => {
    respuestas = [[[{ id: 1, codigo: 'VERANO20' }, { id: 2, codigo: 'AMIGO' }]]];
    const c = await cupones.buscarEnTextos(1, ['quiero 2 hamburguesas', 'tengo el cupon verano20 ok']);
    assert.equal(c.id, 1);
});

test('buscarEnTextos no confunde un código con una palabra más larga', async () => {
    respuestas = [[[{ id: 2, codigo: 'AMIGO' }]]];
    assert.equal(await cupones.buscarEnTextos(1, ['mi amigoncito quiere pedir']), null);
});

test('buscarEnTextos sin cupones activos o con la tabla caída devuelve null', async () => {
    respuestas = [[[]]];
    assert.equal(await cupones.buscarEnTextos(1, ['hola']), null);
    respuestas = [];
    assert.equal(await cupones.buscarEnTextos(1, ['hola']), null); // execute devuelve undefined → error atrapado
});

// ---------- Atención humana ----------
test('pideHumano detecta peticiones claras', () => {
    for (const t of ['quiero hablar con un asesor', 'Pásame con una persona real', 'necesito un humano', 'quiero hablar con el encargado', 'Hablar con alguien por favor', 'ATENCIÓN HUMANA']) {
        assert.equal(pideHumano(t), true, t);
    }
});

test('pideHumano no se dispara con pedidos normales', () => {
    for (const t of ['quiero una pizza para una persona', 'cuánto cuesta el domicilio', 'hola buenas tardes', 'mi dueño de casa me recomendó', '']) {
        assert.equal(pideHumano(t), false, t);
    }
    assert.equal(pideHumano('asesor '.repeat(100)), false); // mensajes largos no son una petición directa
});

// ---------- Encuesta ----------
test('parseCalificacion acepta solo 1 a 5', () => {
    assert.equal(parseCalificacion('5'), 5);
    assert.equal(parseCalificacion(' 4 '), 4);
    assert.equal(parseCalificacion('3 estrellas'), 3);
    assert.equal(parseCalificacion('5/5'), 5);
    assert.equal(parseCalificacion('⭐⭐'), null);
    assert.equal(parseCalificacion('0'), null);
    assert.equal(parseCalificacion('6'), null);
    assert.equal(parseCalificacion('quiero 3 pizzas'), null);
    assert.equal(parseCalificacion('12'), null);
});

test('registrarRespuesta: nota baja pide atención humana; alta agradece', async () => {
    respuestas = [[[{ id: 1, pedido_id: '77' }]], [{ affectedRows: 1 }]];
    const baja = await registrarRespuesta(1, { id: 9 }, '2');
    assert.equal(baja.baja, true);
    assert.equal(baja.calificacion, 2);

    respuestas = [[[{ id: 1, pedido_id: '78' }]], [{ affectedRows: 1 }]];
    const alta = await registrarRespuesta(1, { id: 9 }, '5');
    assert.equal(alta.baja, false);
});

test('registrarRespuesta ignora si no hay encuesta pendiente o ya se respondió', async () => {
    respuestas = [[[]]];
    assert.equal(await registrarRespuesta(1, { id: 9 }, '5'), null);
    respuestas = [[[{ id: 1, pedido_id: '77' }]], [{ affectedRows: 0 }]];
    assert.equal(await registrarRespuesta(1, { id: 9 }, '5'), null);
    assert.equal(await registrarRespuesta(1, { id: 9 }, 'hola'), null);
});

// ---------- Fotos ----------
test('productosMencionados: solo con foto, nombre mencionado, máximo 3', () => {
    const prods = [
        { nombre: 'Hamburguesa Doble', imagen_url: 'https://x.co/a.jpg' },
        { nombre: 'Papas', imagen_url: 'https://x.co/b.jpg' },
        { nombre: 'Gaseosa', imagen_url: null },
        { nombre: 'Malteada', imagen_url: 'ftp://x.co/c.jpg' },
        { nombre: 'Perro', imagen_url: 'https://x.co/d.jpg' },
        { nombre: 'Combo', imagen_url: 'https://x.co/e.jpg' },
    ];
    const r = productosMencionados(prods, ['quiero una hamburguesa doble con papas, gaseosa y malteada', 'perro y combo']);
    assert.deepEqual(r.map((p) => p.nombre), ['Hamburguesa Doble', 'Papas', 'Perro']);
});

test('productosMencionados ignora acentos y mayúsculas', () => {
    const r = productosMencionados([{ nombre: 'Café Latte', imagen_url: 'https://x.co/a.jpg' }], ['un CAFE latte porfa']);
    assert.equal(r.length, 1);
});
