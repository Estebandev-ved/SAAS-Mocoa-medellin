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
    assert.deepStrictEqual(F.datosDisparador(def), { palabraClave: 'promo', primerMensaje: false, evento: null, eventoDias: null });
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

// ---------- condiciones nuevas, pasos de comercio, saltos y disparadores por evento ----------

test('disparadores por evento: se activan sin palabra clave y guardan los días de inactividad', () => {
    const base = (config) => limpio({ nodos: [n('a', 'disparador', config), n('b', 'mensaje', { texto: 'hola' })], conexiones: [c('a', 'default', 'b')] });
    const pagado = base({ modo: 'pedido_pagado' });
    assert.strictEqual(F.validarParaActivar(pagado), null);
    assert.deepStrictEqual(F.datosDisparador(pagado), { palabraClave: null, primerMensaje: false, evento: 'pedido_pagado', eventoDias: null });
    const inactivo = base({ modo: 'cliente_inactivo', dias: 45 });
    assert.deepStrictEqual(F.datosDisparador(inactivo), { palabraClave: null, primerMensaje: false, evento: 'cliente_inactivo', eventoDias: 45 });
    assert.strictEqual(F.datosDisparador(base({ modo: 'cliente_inactivo', dias: 99999 })).eventoDias, 365);
    assert.strictEqual(F.datosDisparador(base({ modo: 'inventado', palabra: 'x' })).palabraClave, 'x');   // modo raro cae en palabra
});

test('condiciones: cada tipo limpia su configuración y los flujos viejos siguen siendo de etiqueta', () => {
    const cond = (config) => limpio({ nodos: [n('a', 'disparador'), n('b', 'condicion', config)], conexiones: [] }).nodos[1].config;
    assert.deepStrictEqual(cond({ valor: 'VIP Gold' }), { tipo: 'etiqueta', valor: 'vip_gold' });
    assert.deepStrictEqual(cond({ tipo: 'dato', campo: 'Barrio', valor: 'Laureles' }), { tipo: 'dato', campo: 'barrio', valor: 'Laureles' });
    assert.deepStrictEqual(cond({ tipo: 'gastado', minimo: '150000' }), { tipo: 'gastado', minimo: 150000 });
    assert.deepStrictEqual(cond({ tipo: 'pedidos', minimo: -3 }), { tipo: 'pedidos', minimo: 0 });
    assert.deepStrictEqual(cond({ tipo: 'stock', producto_id: 7 }), { tipo: 'stock', producto_id: 7, minimo: 1 });
    assert.deepStrictEqual(cond({ tipo: 'horario', basura: 1 }), { tipo: 'horario' });
    assert.strictEqual(cond({ tipo: 'hackeo' }).tipo, 'etiqueta');
});

test('para activar: condiciones y saltos incompletos se rechazan con un motivo', () => {
    const flujo = (nodo) => limpio({ nodos: [n('a', 'disparador', { palabra: 'x' }), nodo], conexiones: [c('a', 'default', nodo.id)] });
    assert.match(F.validarParaActivar(flujo(n('b', 'condicion', { tipo: 'dato', campo: 'barrio' }))), /dato/);
    assert.match(F.validarParaActivar(flujo(n('b', 'condicion', { tipo: 'stock' }))), /producto/);
    assert.match(F.validarParaActivar(flujo(n('b', 'condicion', { tipo: 'etiqueta' }))), /etiqueta/);
    assert.match(F.validarParaActivar(flujo(n('b', 'saltar', {}))), /otro flujo/);
    assert.strictEqual(F.validarParaActivar(flujo(n('b', 'saltar', { flujo_id: 3 }))), null);
    assert.strictEqual(F.validarParaActivar(flujo(n('b', 'condicion', { tipo: 'horario' }))), null);
    assert.strictEqual(F.validarParaActivar(flujo(n('b', 'info_pago', { nota: 'Envía tu comprobante' }))), null);
});

test('motor: condiciones por dato capturado, gastado, pedidos, horario y stock', () => {
    const def = (config) => limpio({
        nodos: [n('a', 'disparador', { palabra: 'x' }), n('b', 'condicion', config), n('c', 'mensaje', { texto: 'SI' }), n('d', 'mensaje', { texto: 'NO' })],
        conexiones: [c('a', 'default', 'b'), c('b', 'si', 'c'), c('b', 'no', 'd')],
    });
    const texto = (d, cliente) => M.iniciar(d, cliente).acciones[0].texto;
    assert.strictEqual(texto(def({ tipo: 'gastado', minimo: 100000 }), { total_gastado: 150000 }), 'SI');
    assert.strictEqual(texto(def({ tipo: 'gastado', minimo: 100000 }), { total_gastado: 99999 }), 'NO');
    assert.strictEqual(texto(def({ tipo: 'pedidos', minimo: 2 }), { total_pedidos: 2 }), 'SI');
    assert.strictEqual(texto(def({ tipo: 'pedidos', minimo: 2 }), {}), 'NO');
    assert.strictEqual(texto(def({ tipo: 'horario' }), { dentroHorario: false }), 'NO');
    assert.strictEqual(texto(def({ tipo: 'horario' }), {}), 'SI');   // sin dato: se asume abierto
    assert.strictEqual(texto(def({ tipo: 'stock', producto_id: 7, minimo: 2 }), { stock: { 7: 1 } }), 'NO');
    assert.strictEqual(texto(def({ tipo: 'stock', producto_id: 7, minimo: 2 }), { stock: { 7: 5 } }), 'SI');
    assert.strictEqual(texto(def({ tipo: 'stock', producto_id: 7, minimo: 2 }), { stock: { 7: null } }), 'SI'); // no controla inventario
    assert.strictEqual(texto(def({ tipo: 'stock', producto_id: 7 }), {}), 'SI');
});

test('motor: condición por dato usa lo que el cliente respondió antes', () => {
    const d = limpio({
        nodos: [n('a', 'disparador', { palabra: 'x' }), n('p', 'pregunta', { texto: '¿Barrio?', campo: 'barrio' }), n('k', 'condicion', { tipo: 'dato', campo: 'barrio', valor: 'laureles' }),
            n('s', 'mensaje', { texto: 'Cubrimos tu zona' }), n('f', 'mensaje', { texto: 'Aún no llegamos' })],
        conexiones: [c('a', 'default', 'p'), c('p', 'default', 'k'), c('k', 'si', 's'), c('k', 'no', 'f')],
    });
    const ini = M.iniciar(d, { nombre: 'Ana' });
    assert.strictEqual(M.continuar(d, ini.ejec, 'Vivo en Laureles, cerca del parque', { nombre: 'Ana' }).acciones[0].texto, 'Cubrimos tu zona');
    assert.strictEqual(M.continuar(d, ini.ejec, 'Belén', { nombre: 'Ana' }).acciones[0].texto, 'Aún no llegamos');
});

test('motor: info de pago y salto a otro flujo', () => {
    const d = limpio({
        nodos: [n('a', 'disparador', { palabra: 'x' }), n('b', 'info_pago', { nota: 'Envía el comprobante' }), n('c', 'saltar', { flujo_id: 9 })],
        conexiones: [c('a', 'default', 'b'), c('b', 'default', 'c')],
    });
    const r = M.iniciar(d, { nombre: 'Ana' });
    assert.deepStrictEqual(r.acciones, [{ tipo: 'info_pago', nota: 'Envía el comprobante' }]);
    assert.strictEqual(r.saltar, 9);
    assert.strictEqual(r.ejec.estado, 'terminada');
});
