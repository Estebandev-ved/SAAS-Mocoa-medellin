const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// renovacion.js usa billing.js, que abre la base al cargarse: se reemplaza por una simulada.
const ruta = require.resolve(path.join('..', '..', 'db', 'config'));
require.cache[ruta] = { id: ruta, filename: ruta, loaded: true, exports: { async execute() { return [[]]; } } };

const { etapaDeAviso, refAviso, construirAviso, revisarRenovaciones } = require('../../api/services/renovacion');
const { enviarCorreo, correoConfigurado } = require('../../api/services/correo');

const AHORA = new Date('2026-12-10T12:00:00Z');
const enHoras = (h) => new Date(AHORA.getTime() + h * 3600000);

// Cuenta nueva en prueba: suscripcion_activa=1, sin suscripcion_inicio.
const prueba = (finEnHoras) => ({ suscripcion_activa: 1, suscripcion_inicio: null, suscripcion_fin: enHoras(finEnHoras), trial_hasta: enHoras(finEnHoras) });
// Cuenta que ya pagó un ciclo.
const pagada = (finEnHoras) => ({ suscripcion_activa: 1, suscripcion_inicio: enHoras(-500), suscripcion_fin: enHoras(finEnHoras), trial_hasta: null });
const vencida = (hace) => ({ suscripcion_activa: 0, suscripcion_inicio: enHoras(-900), suscripcion_fin: enHoras(-hace), trial_hasta: null });

test('etapas: avisa a 3 y 1 días, el día que vence y como último aviso; el resto del tiempo calla', () => {
    assert.strictEqual(etapaDeAviso(pagada(24 * 10), AHORA), null);
    assert.strictEqual(etapaDeAviso(pagada(24 * 3 + 5), AHORA), null);       // 3 días y 5 h: todavía no
    assert.strictEqual(etapaDeAviso(pagada(24 * 3), AHORA).etapa, 'faltan_3');
    assert.strictEqual(etapaDeAviso(pagada(24 * 2 - 1), AHORA).etapa, 'faltan_3');
    assert.strictEqual(etapaDeAviso(pagada(20), AHORA).etapa, 'faltan_1');
    assert.strictEqual(etapaDeAviso(pagada(20), AHORA).dias, 1);
    assert.strictEqual(etapaDeAviso(vencida(5), AHORA).etapa, 'vencio');
    assert.strictEqual(etapaDeAviso(vencida(71), AHORA).etapa, 'vencio');
    assert.strictEqual(etapaDeAviso(vencida(80), AHORA).etapa, 'ultimo');
    assert.strictEqual(etapaDeAviso(vencida(143), AHORA).etapa, 'ultimo');
    assert.strictEqual(etapaDeAviso(vencida(24 * 10), AHORA), null);          // ya pasó demasiado: no se insiste
});

test('etapas: distingue la prueba gratis del plan pagado', () => {
    assert.strictEqual(etapaDeAviso(prueba(20), AHORA).esPrueba, true);
    assert.strictEqual(etapaDeAviso(pagada(20), AHORA).esPrueba, false);
    const trialVencido = { suscripcion_activa: 0, suscripcion_inicio: null, suscripcion_fin: enHoras(-10), trial_hasta: enHoras(-10) };
    assert.strictEqual(etapaDeAviso(trialVencido, AHORA).esPrueba, true);
});

test('etapas: no molesta a quien canceló a propósito ni a cuentas que nunca activaron nada', () => {
    const cancelada = { suscripcion_activa: 0, suscripcion_inicio: enHoras(-500), suscripcion_fin: enHoras(20), trial_hasta: null };
    assert.strictEqual(etapaDeAviso(cancelada, AHORA), null);
    assert.strictEqual(etapaDeAviso({ suscripcion_activa: 0, suscripcion_inicio: null, suscripcion_fin: null, trial_hasta: null }, AHORA), null);
});

test('referencia: conserva el formato anterior (-3 / -1) y agrega las etapas nuevas', () => {
    const fin = '2026-12-12T00:00:00Z';
    assert.strictEqual(refAviso(7, fin, 'faltan_3'), '7-2026-12-12-3');
    assert.strictEqual(refAviso(7, fin, 'faltan_1'), '7-2026-12-12-1');
    assert.strictEqual(refAviso(7, fin, 'vencio'), '7-2026-12-12-v0');
    assert.strictEqual(refAviso(7, fin, 'ultimo'), '7-2026-12-12-v3');
});

test('mensaje: textos por etapa y el HTML escapa el nombre del negocio', () => {
    const url = 'https://app.antigravity.co/suscripcion';
    const a = construirAviso({ nombre: 'Granizados <b>Pepe</b>', etapa: 'faltan_1', dias: 1, esPrueba: false }, url);
    assert.match(a.titulo, /vence en 1 día$/);
    assert.ok(!a.html.includes('<b>Pepe</b>'), 'el HTML del nombre debe ir escapado');
    assert.ok(a.html.includes('&lt;b&gt;Pepe&lt;/b&gt;'));
    assert.ok(a.html.includes(url));
    assert.match(construirAviso({ nombre: 'X', etapa: 'faltan_3', dias: 3, esPrueba: true }, url).titulo, /prueba gratis vence en 3 días/i);
    assert.match(construirAviso({ nombre: 'X', etapa: 'vencio', dias: 0, esPrueba: false }, url).titulo, /venció/);
    assert.match(construirAviso({ nombre: 'X', etapa: 'ultimo', dias: 0, esPrueba: false }, url).titulo, /en pausa/);
});

function montaje(negocios, { smtp = true, wa = true } = {}) {
    const yaAvisados = new Set();
    const registro = { correos: [], whatsapps: [], notificaciones: [] };
    const deps = {
        db: { async execute() { return [negocios]; } },
        ahora: () => AHORA,
        urlApp: 'https://app.antigravity.co/suscripcion',
        async yaSeNotifico(id, tipo, ref) { return yaAvisados.has(`${id}|${tipo}|${ref}`); },
        async registrarNotificacion(id, tipo, titulo, mensaje, ref, datos) { yaAvisados.add(`${id}|${tipo}|${ref}`); registro.notificaciones.push({ id, ref, datos }); },
        async enviarWhatsApp(id, numero, msg) { if (wa) registro.whatsapps.push({ id, numero, msg }); return wa; },
        async enviarCorreo(c) { if (!smtp) return { ok: false, motivo: 'sin_smtp' }; registro.correos.push(c); return { ok: true }; },
    };
    return { deps, registro };
}

test('revisarRenovaciones: avisa por correo, WhatsApp y panel, y no repite en la siguiente pasada', async () => {
    const { deps, registro } = montaje([
        { id: 1, nombre: 'Caja de Ana', email_dueno: 'ana@x.co', whatsapp: null, ...pagada(20) },          // sin bot: solo correo + panel
        { id: 2, nombre: 'Pizzería', email_dueno: 'pizza@x.co', whatsapp: '573001112233', ...vencida(5) }, // venció
        { id: 3, nombre: 'Tranquilo', email_dueno: 't@x.co', whatsapp: '573009998877', ...pagada(24 * 20) }, // lejos: nada
    ]);
    const r1 = await revisarRenovaciones(deps);
    assert.deepStrictEqual(r1, { revisados: 3, avisados: 2 });
    assert.deepStrictEqual(registro.correos.map((c) => c.para).sort(), ['ana@x.co', 'pizza@x.co']);
    assert.strictEqual(registro.whatsapps.length, 1);
    assert.strictEqual(registro.whatsapps[0].id, 2);
    assert.ok(registro.correos[0].texto.includes('https://app.antigravity.co/suscripcion'));
    const ana = registro.notificaciones.find((x) => x.id === 1);
    assert.deepStrictEqual([ana.datos.enviado_correo, ana.datos.enviado_whatsapp, ana.datos.etapa], [true, false, 'faltan_1']);

    const r2 = await revisarRenovaciones(deps);
    assert.deepStrictEqual(r2, { revisados: 3, avisados: 0 });
    assert.strictEqual(registro.correos.length, 2, 'no se reenvía lo ya avisado');
});

test('revisarRenovaciones: sin SMTP igual deja la notificación del panel; un fallo en un negocio no frena a los demás', async () => {
    const { deps, registro } = montaje([
        { id: 1, nombre: 'A', email_dueno: 'a@x.co', whatsapp: null, ...pagada(20) },
        { id: 2, nombre: 'B', email_dueno: 'b@x.co', whatsapp: null, ...pagada(20) },
    ], { smtp: false, wa: false });
    let primera = true;
    const original = deps.registrarNotificacion;
    deps.registrarNotificacion = async (...a) => { if (primera) { primera = false; throw new Error('falló la base'); } return original(...a); };
    const prevError = console.error; console.error = () => {};
    const prevWarn = console.warn; console.warn = () => {};
    try {
        const r = await revisarRenovaciones(deps);
        assert.strictEqual(r.avisados, 1);
    } finally { console.error = prevError; console.warn = prevWarn; }
    assert.strictEqual(registro.notificaciones.length, 1);
    assert.deepStrictEqual([registro.notificaciones[0].datos.enviado_correo, registro.notificaciones[0].datos.enviado_whatsapp], [false, false]);
});

test('correo: sin SMTP o con un correo inválido no lanza error; con transporte envía una vez', async () => {
    assert.strictEqual(correoConfigurado({}), false);
    assert.strictEqual(correoConfigurado({ SMTP_USER: 'a@x.co', SMTP_PASS: 'clave' }), true);
    assert.deepStrictEqual(await enviarCorreo({ para: 'a@x.co', asunto: 'x', texto: 'y' }, { env: {} }), { ok: false, motivo: 'sin_smtp' });
    assert.deepStrictEqual(await enviarCorreo({ para: 'no-es-correo', asunto: 'x', texto: 'y' }, { env: {} }), { ok: false, motivo: 'sin_correo' });

    const enviados = [];
    const transporte = { async sendMail(m) { enviados.push(m); } };
    const ok = await enviarCorreo({ para: ' a@x.co ', asunto: 'Hola', texto: 'Texto', html: '<p>Hola</p>' }, { transporte, env: { SMTP_USER: 'avisos@x.co' } });
    assert.deepStrictEqual(ok, { ok: true });
    assert.strictEqual(enviados[0].to, 'a@x.co');
    assert.match(enviados[0].from, /avisos@x\.co/);

    const roto = { async sendMail() { throw Object.assign(new Error('sin conexión'), { code: 'ECONNECTION' }); } };
    const prev = console.error; console.error = () => {};
    try { assert.strictEqual((await enviarCorreo({ para: 'a@x.co', asunto: 'x', texto: 'y' }, { transporte: roto })).motivo, 'error'); }
    finally { console.error = prev; }
});
