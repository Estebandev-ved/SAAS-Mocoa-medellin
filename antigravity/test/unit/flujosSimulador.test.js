const test = require('node:test');
const assert = require('node:assert');
const { simular } = require('../../api/services/flujosSimulador');

const n = (id, tipo, config = {}) => ({ id, tipo, x: 0, y: 0, config });
const c = (desde, salida, hacia) => ({ desde, salida, hacia });
const definicion = {
    nodos: [
        n('a', 'disparador', { modo: 'palabra', palabra: 'promo' }),
        n('b', 'mensaje', { texto: 'Hola {nombre}' }),
        n('c', 'opciones', { texto: '¿Qué quieres?', o1: 'Pedir', o2: 'Etiquetar', o3: 'Esperar' }),
        n('d', 'ia', { instruccion: 'Toma el pedido.' }),
        n('e', 'etiqueta', { accion: 'poner', nombre: 'VIP' }),
        n('f', 'espera', { cantidad: 5, unidad: 'minutos' }),
        n('g', 'mensaje', { texto: 'Ya pasó el rato' }),
    ],
    conexiones: [c('a', 'default', 'b'), c('b', 'default', 'c'), c('c', '1', 'd'), c('c', '2', 'e'), c('c', '3', 'f'), c('f', 'default', 'g')],
};
const textos = (r) => r.mensajes.map((m) => m.texto);

test('un mensaje que no es la palabra clave no inicia el flujo', () => {
    const r = simular({ definicion, modo: 'mensaje', texto: 'hola', nombre: 'Ana Pérez' });
    assert.strictEqual(r.ejec, null);
    assert.match(r.mensajes[0].texto, /no inicia el flujo.*promo/);
});

test('conversación completa con opciones, etiqueta y espera', () => {
    let r = simular({ definicion, modo: 'mensaje', texto: 'Quiero la PROMO', nombre: 'Ana Pérez' });
    assert.strictEqual(r.mensajes[0].texto, 'Hola Ana');
    assert.match(r.mensajes[1].texto, /1\. Pedir/);
    assert.strictEqual(r.ejec.estado, 'esperando_respuesta');

    const etiq = simular({ definicion, modo: 'mensaje', texto: '2', ejec: r.ejec, nombre: 'Ana' });
    assert.deepStrictEqual(etiq.etiquetas, ['vip']);
    assert.ok(textos(etiq).some((t) => /Fin del flujo/.test(t)));
    assert.strictEqual(etiq.ejec, null);

    const ia = simular({ definicion, modo: 'mensaje', texto: '1', ejec: r.ejec, nombre: 'Ana' });
    assert.ok(textos(ia).some((t) => /Toma el pedido/.test(t)));

    const espera = simular({ definicion, modo: 'mensaje', texto: '3', ejec: r.ejec, nombre: 'Ana' });
    assert.strictEqual(espera.ejec.estado, 'esperando_tiempo');
    const despues = simular({ definicion, modo: 'saltar_espera', ejec: espera.ejec, nombre: 'Ana' });
    assert.ok(textos(despues).includes('Ya pasó el rato'));
});

test('errores: flujo inválido, mensaje vacío y saltar sin espera', () => {
    assert.ok(simular({ definicion: { nodos: [], conexiones: [] }, modo: 'mensaje', texto: 'x' }).error);
    assert.ok(simular({ definicion, modo: 'mensaje', texto: '   ' }).error);
    assert.ok(simular({ definicion, modo: 'saltar_espera' }).error);
});

test('el estado que manda el navegador se sanea (no confía en nada)', () => {
    const r = simular({ definicion, modo: 'mensaje', texto: 'hola', ejec: { estado: 'terminada', nodo_actual: 'c' }, etiquetas: ['<b>X</b>', 5, null] });
    assert.strictEqual(r.ejec, null);
    assert.deepStrictEqual(r.etiquetas, ['bxb']);
    const raro = simular({ definicion, modo: 'mensaje', texto: 'promo', ejec: { estado: 'esperando_respuesta', nodo_actual: 'no_existe', contexto: 'x' } });
    assert.ok(raro.mensajes.length > 0);
});
