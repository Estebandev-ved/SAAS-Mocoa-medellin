const test = require('node:test');
const assert = require('node:assert');
const F = require('../../api/services/flujos');
const M = require('../../api/services/flujosMotor');

const n = (id, tipo, config = {}, x = 0, y = 0) => ({ id, tipo, x, y, config });
const c = (desde, salida, hacia) => ({ desde, salida, hacia });

// Flujo de ejemplo (igual al del prototipo): PROMO -> mensaje -> opciones -> pedido / IA / etiqueta
function ejemplo() {
    return {
        nodos: [
            n('a', 'disparador', { modo: 'palabra', palabra: 'PROMO' }),
            n('b', 'mensaje', { texto: '¡Hola {nombre}! Hoy 2x1.' }),
            n('c', 'opciones', { texto: '¿Te animas?', o1: 'Sí, pedir', o2: 'Ver menú', o3: 'Más tarde' }),
            n('d', 'pedido', { cobrar: true }),
            n('e', 'ia', { instruccion: 'Muestra el menú.' }),
            n('f', 'etiqueta', { accion: 'poner', nombre: 'Recordar Promo' }),
        ],
        conexiones: [c('a', 'default', 'b'), c('b', 'default', 'c'), c('c', '1', 'd'), c('c', '2', 'e'), c('c', '3', 'f')],
    };
}
const limpio = (d) => { const r = F.validarDefinicion(d); assert.ok(r.definicion, r.error); return r.definicion; };

// ---------- validación ----------

test('el flujo de ejemplo es válido y se puede activar', () => {
    const def = limpio(ejemplo());
    assert.strictEqual(F.validarParaActivar(def), null);
    assert.deepStrictEqual(F.datosDisparador(def), { palabraClave: 'promo', primerMensaje: false });
});

test('rechaza formatos raros, tipos desconocidos, ids malos y exceso de pasos', () => {
    assert.ok(F.validarDefinicion(null).error);
    assert.ok(F.validarDefinicion({ nodos: [], conexiones: [] }).error);
    assert.ok(F.validarDefinicion({ nodos: [n('a', 'hackeo')], conexiones: [] }).error);
    assert.ok(F.validarDefinicion({ nodos: [n('a b', 'disparador')], conexiones: [] }).error);
    const muchos = Array.from({ length: 31 }, (_, i) => n(`m${i}`, 'mensaje'));
    assert.ok(F.validarDefinicion({ nodos: [n('a', 'disparador'), ...muchos], conexiones: [] }).error);
});

test('exige un solo disparador y conexiones coherentes', () => {
    assert.ok(F.validarDefinicion({ nodos: [n('a', 'mensaje')], conexiones: [] }).error);
    assert.ok(F.validarDefinicion({ nodos: [n('a', 'disparador'), n('b', 'disparador')], conexiones: [] }).error);
    const base = [n('a', 'disparador'), n('b', 'mensaje'), n('c', 'mensaje')];
    assert.ok(F.validarDefinicion({ nodos: base, conexiones: [c('a', 'default', 'zzz')] }).error);
    assert.ok(F.validarDefinicion({ nodos: base, conexiones: [c('a', 'si', 'b')] }).error);
    assert.ok(F.validarDefinicion({ nodos: base, conexiones: [c('b', 'default', 'b')] }).error);
    assert.ok(F.validarDefinicion({ nodos: base, conexiones: [c('b', 'default', 'a')] }).error);
    assert.ok(F.validarDefinicion({ nodos: base, conexiones: [c('a', 'default', 'b'), c('a', 'default', 'c')] }).error);
});

test('limpia la configuración: recorta, acota y descarta campos desconocidos', () => {
    const def = limpio({
        nodos: [n('a', 'disparador', { modo: 'x', palabra: 'a'.repeat(200), extra: 'no' }), n('b', 'espera', { cantidad: 99999, unidad: 'siglos' }),
            n('c', 'mensaje', { texto: 'x'.repeat(900) }), n('d', 'etiqueta', { nombre: '  Cliente VIP!! ' })],
        conexiones: [],
    });
    assert.strictEqual(def.nodos[0].config.modo, 'palabra');
    assert.strictEqual(def.nodos[0].config.palabra.length, 60);
    assert.strictEqual(def.nodos[0].config.extra, undefined);
    assert.deepStrictEqual(def.nodos[1].config, { cantidad: 1440, unidad: 'minutos' });
    assert.strictEqual(def.nodos[2].config.texto.length, 500);
    assert.strictEqual(def.nodos[3].config.nombre, 'cliente_vip');
});

test('para activar: palabra, conexión, pasos sueltos, opciones sin destino y círculos sin pausa', () => {
    const base = ejemplo();
    const sinPalabra = limpio({ ...base, nodos: base.nodos.map((x) => (x.id === 'a' ? n('a', 'disparador', { modo: 'palabra', palabra: '' }) : x)) });
    assert.match(F.validarParaActivar(sinPalabra), /palabra clave/);

    const suelto = limpio({ ...base, nodos: [...base.nodos, n('z', 'mensaje', { texto: 'hola' })] });
    assert.match(F.validarParaActivar(suelto), /sin conectar/);

    const sinOpcion3 = limpio({ nodos: base.nodos.filter((x) => x.id !== 'f'), conexiones: base.conexiones.filter((x) => x.salida !== '3') });
    assert.match(F.validarParaActivar(sinOpcion3), /opción 3/);

    const bucle = limpio({
        nodos: [n('a', 'disparador', { palabra: 'x' }), n('b', 'mensaje', { texto: 'uno' }), n('c', 'mensaje', { texto: 'dos' })],
        conexiones: [c('a', 'default', 'b'), c('b', 'default', 'c'), c('c', 'default', 'b')],
    });
    assert.match(F.validarParaActivar(bucle), /círculo/);

    const conPausa = limpio({
        nodos: [n('a', 'disparador', { palabra: 'x' }), n('b', 'mensaje', { texto: 'uno' }), n('c', 'espera', { cantidad: 5 })],
        conexiones: [c('a', 'default', 'b'), c('b', 'default', 'c'), c('c', 'default', 'b')],
    });
    assert.strictEqual(F.validarParaActivar(conPausa), null);
});

test('límites por plan', () => {
    assert.strictEqual(F.limiteDeFlujos('emprendedor'), 3);
    assert.strictEqual(F.limiteDeFlujos('professional'), 20);
    assert.strictEqual(F.limiteDeFlujos('enterprise'), Infinity);
    assert.strictEqual(F.limiteDeFlujos('inventado'), 3);
});

// ---------- motor ----------

test('palabra clave: palabra completa, sin tildes ni mayúsculas', () => {
    assert.ok(M.coincidePalabra('promo', 'Hola, quiero la PROMO!'));
    assert.ok(M.coincidePalabra('menu', 'ver el menú'));
    assert.ok(!M.coincidePalabra('promo', 'promociones'));
    assert.ok(!M.coincidePalabra(null, 'promo'));
});

test('de punta a punta: PROMO → mensaje con nombre → opciones → opción 1 → IA con pedido', () => {
    const def = limpio(ejemplo());
    const cliente = { nombre: 'María García', etiquetas: [] };
    const ini = M.iniciar(def, cliente);
    assert.strictEqual(ini.acciones[0].texto, '¡Hola María! Hoy 2x1.');
    assert.match(ini.acciones[1].texto, /¿Te animas\?\n\n1\. Sí, pedir\n2\. Ver menú\n3\. Más tarde/);
    assert.strictEqual(ini.ejec.estado, 'esperando_respuesta');
    assert.strictEqual(ini.ejec.nodo_actual, 'c');

    const r = M.continuar(def, ini.ejec, '1', cliente);
    assert.strictEqual(r.ejec.estado, 'terminada');
    assert.match(r.ia, /pedido/);
    assert.match(r.ia, /pagar/);
});

test('opciones: por texto, y si no entiende pide el número hasta rendirse y cae en la IA', () => {
    const def = limpio(ejemplo());
    const cliente = { nombre: '' };
    let ejec = M.iniciar(def, cliente).ejec;

    const porTexto = M.continuar(def, ejec, 'ver menu', cliente);
    assert.strictEqual(porTexto.ia, 'Muestra el menú.');

    let r = M.continuar(def, ejec, 'asdf', cliente);
    assert.match(r.acciones[0].texto, /No te entendí/);
    assert.strictEqual(r.ejec.estado, 'esperando_respuesta');
    ejec = r.ejec;
    r = M.continuar(def, ejec, 'qwerty', cliente);
    assert.strictEqual(r.fallback, false);
    r = M.continuar(def, r.ejec, 'zzz', cliente);
    assert.strictEqual(r.fallback, true);
    assert.strictEqual(r.ejec.estado, 'terminada');
});

test('etiqueta: se normaliza y se pide ponerla', () => {
    const def = limpio(ejemplo());
    const ini = M.iniciar(def, { nombre: 'Ana' });
    const r = M.continuar(def, ini.ejec, '3', { nombre: 'Ana' });
    assert.deepStrictEqual(r.acciones, [{ tipo: 'etiqueta', accion: 'poner', nombre: 'recordar_promo' }]);
});

test('pregunta guarda la respuesta y se usa después como {campo}', () => {
    const def = limpio({
        nodos: [n('a', 'disparador', { palabra: 'hola' }), n('b', 'pregunta', { texto: '¿Tu barrio?', campo: 'barrio' }), n('c', 'mensaje', { texto: 'Enviamos a {barrio}, {nombre}.' })],
        conexiones: [c('a', 'default', 'b'), c('b', 'default', 'c')],
    });
    const ini = M.iniciar(def, { nombre: 'Luis Pérez' });
    assert.strictEqual(ini.acciones[0].texto, '¿Tu barrio?');
    const r = M.continuar(def, ini.ejec, 'Laureles', { nombre: 'Luis Pérez' });
    assert.strictEqual(r.acciones[0].texto, 'Enviamos a Laureles, Luis.');
    assert.strictEqual(r.ejec.estado, 'terminada');
});

test('espera: deja la ejecución dormida hasta la hora y luego sigue', () => {
    const def = limpio({
        nodos: [n('a', 'disparador', { palabra: 'x' }), n('b', 'espera', { cantidad: 2, unidad: 'horas' }), n('c', 'mensaje', { texto: '¿Sigues ahí?' })],
        conexiones: [c('a', 'default', 'b'), c('b', 'default', 'c')],
    });
    const ahora = new Date('2026-10-21T10:00:00Z');
    const ini = M.iniciar(def, { nombre: 'Ana' }, ahora);
    assert.strictEqual(ini.ejec.estado, 'esperando_tiempo');
    assert.strictEqual(ini.ejec.reanudar_en.toISOString(), '2026-10-21T12:00:00.000Z');
    const r = M.reanudar(def, ini.ejec, { nombre: 'Ana' }, new Date('2026-10-21T12:00:01Z'));
    assert.strictEqual(r.acciones[0].texto, '¿Sigues ahí?');
    assert.strictEqual(r.ejec.estado, 'terminada');
});

test('condición por etiqueta bifurca; asesor termina y pide derivar', () => {
    const def = limpio({
        nodos: [n('a', 'disparador', { palabra: 'x' }), n('b', 'condicion', { valor: 'vip' }), n('c', 'mensaje', { texto: 'Hola VIP' }), n('d', 'asesor', { aviso: 'Te paso con alguien.' })],
        conexiones: [c('a', 'default', 'b'), c('b', 'si', 'c'), c('b', 'no', 'd')],
    });
    assert.strictEqual(M.iniciar(def, { nombre: 'A', etiquetas: ['vip'] }).acciones[0].texto, 'Hola VIP');
    const r = M.iniciar(def, { nombre: 'A', etiquetas: [] });
    assert.deepStrictEqual(r.acciones, [{ tipo: 'asesor', aviso: 'Te paso con alguien.' }]);
    assert.strictEqual(r.ejec.estado, 'terminada');
});

test('un bucle sin pausa se corta con error en vez de colgar', () => {
    const def = {
        nodos: [n('a', 'disparador'), n('b', 'mensaje', { texto: 'uno' }), n('c', 'mensaje', { texto: 'dos' })],
        conexiones: [c('a', 'default', 'b'), c('b', 'default', 'c'), c('c', 'default', 'b')],
    };
    const r = M.iniciar(def, { nombre: 'A' });
    assert.strictEqual(r.ejec.estado, 'error');
    assert.ok(r.acciones.length <= M.MAX_PASOS);
});

test('métricas: junta estados y descuenta los que ya abandonaron de "en curso"', () => {
    const r = F.resumirMetricas(
        [{ estado: 'terminada', total: 6 }, { estado: 'esperando_respuesta', total: 5 }, { estado: 'esperando_tiempo', total: 1 }, { estado: 'error', total: 1 }],
        [{ nodo_actual: 'c', total: 3 }, { nodo_actual: 'b', total: 1 }]
    );
    assert.deepStrictEqual(r, { entraron: 13, terminaron: 6, en_curso: 2, con_error: 1, abandonaron: 4, abandonos: [{ nodo: 'c', total: 3 }, { nodo: 'b', total: 1 }] });
    assert.strictEqual(F.resumirMetricas([], []).entraron, 0);
});
