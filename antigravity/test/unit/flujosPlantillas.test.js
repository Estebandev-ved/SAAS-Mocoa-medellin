const test = require('node:test');
const assert = require('node:assert');
const F = require('../../api/services/flujos');
const M = require('../../api/services/flujosMotor');
const { PLANTILLAS, listarPlantillas } = require('../../api/services/flujosPlantillas');
const { TIPOS_NEGOCIO, familiaDe } = require('../../api/services/tiposNegocio');

test('todas las plantillas son válidas, se pueden encender tal cual y no se alteran al validarlas', () => {
    assert.ok(PLANTILLAS.length >= 8);
    const ids = new Set();
    for (const p of PLANTILLAS) {
        assert.ok(!ids.has(p.id), `id repetido: ${p.id}`);
        ids.add(p.id);
        assert.ok(p.nombre && p.descripcion, `${p.id} sin nombre o descripción`);
        const r = F.validarDefinicion(p.definicion);
        assert.ok(r.definicion, `${p.id}: ${r.error}`);
        assert.strictEqual(F.validarParaActivar(r.definicion), null, `${p.id} no se puede activar`);
        // La limpieza no debe cambiar nada de lo que escribimos (si cambia, hay un valor fuera de rango)
        assert.deepStrictEqual(r.definicion.nodos.map((n) => n.config), p.definicion.nodos.map((n) => ({ ...F.TIPOS[n.tipo].limpiar(n.config) })));
    }
});

test('las familias recomendadas existen en el catálogo de tipos de negocio', () => {
    const familias = new Set(TIPOS_NEGOCIO.map(familiaDe));
    for (const p of PLANTILLAS) for (const f of p.familias) assert.ok(familias.has(f), `${p.id}: familia desconocida "${f}"`);
});

test('cada plantilla corre de punta a punta en el motor y su primer mensaje no queda vacío ni con llaves sin resolver', () => {
    for (const p of PLANTILLAS) {
        const def = F.validarDefinicion(p.definicion).definicion;
        const r = M.iniciar(def, { nombre: 'Ana Gómez', etiquetas: [], dentroHorario: true });
        const textos = r.acciones.filter((a) => a.tipo === 'enviar').map((a) => a.texto);
        assert.ok(r.acciones.length > 0, `${p.id}: no hace nada al iniciar`);
        for (const t of textos) assert.ok(!/\{[^}]*\}/.test(t) || /\{(nombre_cliente|interes|fecha|nombre_completo)\}/.test(p.definicion.nodos.map((n) => n.config.texto).join('')), `${p.id}: llaves sin resolver en "${t}"`);
    }
});

test('el flujo de cita guarda las respuestas y las usa en el mensaje final', () => {
    const def = F.validarDefinicion(PLANTILLAS.find((p) => p.id === 'cita').definicion).definicion;
    const cliente = { nombre: 'Cliente 1234' };
    let r = M.iniciar(def, cliente);
    r = M.continuar(def, r.ejec, 'María López', cliente);
    r = M.continuar(def, r.ejec, 'el viernes a las 3 pm', cliente);
    const dicho = r.acciones.filter((a) => a.tipo === 'enviar').map((a) => a.texto).join(' ');
    assert.match(dicho, /María López/);
    assert.match(dicho, /el viernes a las 3 pm/);
    assert.ok(r.acciones.some((a) => a.tipo === 'etiqueta' && a.nombre === 'cita_pendiente'));
    assert.ok(r.acciones.some((a) => a.tipo === 'asesor'));
});

test('horario: la plantilla responde distinto abierto y cerrado', () => {
    const def = F.validarDefinicion(PLANTILLAS.find((p) => p.id === 'horario').definicion).definicion;
    assert.match(M.iniciar(def, { nombre: 'A', dentroHorario: true }).acciones[0].texto, /abiertos/);
    assert.match(M.iniciar(def, { nombre: 'A', dentroHorario: false }).acciones[0].texto, /cerrados/);
});

test('seguimiento: queda dormido 2 horas y luego escribe con el interés guardado', () => {
    const def = F.validarDefinicion(PLANTILLAS.find((p) => p.id === 'seguimiento').definicion).definicion;
    const t0 = new Date('2026-10-21T10:00:00Z');
    let r = M.iniciar(def, { nombre: 'Luis' }, t0);
    r = M.continuar(def, r.ejec, 'zapatos deportivos', { nombre: 'Luis' }, t0);
    assert.strictEqual(r.ejec.estado, 'esperando_tiempo');
    assert.strictEqual(r.ejec.reanudar_en.toISOString(), '2026-10-21T12:00:00.000Z');
    const despues = M.reanudar(def, r.ejec, { nombre: 'Luis' }, new Date('2026-10-21T12:01:00Z'));
    assert.match(despues.acciones[0].texto, /Hola Luis.*zapatos deportivos/);
});

test('recomendadas primero según la familia del negocio', () => {
    const lista = listarPlantillas('salud');
    const nombres = lista.map((p) => p.id);
    assert.ok(nombres.indexOf('cita') < nombres.indexOf('menu'));
    assert.ok(lista.find((p) => p.id === 'cita').recomendada);
    assert.ok(!lista.find((p) => p.id === 'menu').recomendada);
    assert.ok(lista.find((p) => p.id === 'promo').recomendada);   // las de "todos" siempre
    assert.strictEqual(listarPlantillas().length, PLANTILLAS.length);
});
