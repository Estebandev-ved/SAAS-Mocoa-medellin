// Plan Universitario: correo de la universidad verificado con un código antes de poder comprarlo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { crearServicio, esCorreoUniversitario } = require('../../api/services/universitario');
const { PLAN_ORDER, hasFeature, getPlan, requiereCorreoUniversitario } = require('../../config/planConfig');

// Base simulada: solo entiende las consultas de verificaciones_universitarias.
function baseFalsa() {
    const filas = new Map();
    return {
        filas,
        async execute(sql, p = []) {
            const q = sql.replace(/\s+/g, ' ').trim();
            if (q.startsWith('SELECT correo, codigo_hash')) return [filas.has(p[0]) ? [{ ...filas.get(p[0]) }] : []];
            if (q.startsWith('SELECT negocio_id FROM verificaciones_universitarias')) {
                const [correo, negocioId, ahora] = p;
                return [[...filas.entries()]
                    .filter(([id, f]) => f.correo === correo && id !== negocioId && f.verificado_en && f.valido_hasta > ahora)
                    .map(([id]) => ({ negocio_id: id }))];
            }
            if (q.startsWith('INSERT INTO verificaciones_universitarias')) {
                const [id, correo, codigo_hash, codigo_expira, envios_hoy, envios_fecha] = p;
                const previa = filas.get(id);
                const mismo = previa && previa.correo === correo;
                filas.set(id, {
                    correo, codigo_hash, codigo_expira, intentos: 0, envios_hoy, envios_fecha,
                    verificado_en: mismo ? previa.verificado_en : null,
                    valido_hasta: mismo ? previa.valido_hasta : null,
                });
                return [{ affectedRows: 1 }];
            }
            if (q.startsWith('UPDATE verificaciones_universitarias SET intentos = intentos + 1')) {
                filas.get(p[0]).intentos += 1;
                return [{ affectedRows: 1 }];
            }
            if (q.startsWith('UPDATE verificaciones_universitarias SET verificado_en')) {
                const f = filas.get(p[2]);
                Object.assign(f, { verificado_en: p[0], valido_hasta: p[1], codigo_hash: null, codigo_expira: null, intentos: 0 });
                return [{ affectedRows: 1 }];
            }
            throw new Error(`Consulta no simulada: ${q}`);
        },
    };
}

function montar({ ahora = new Date('2026-11-25T15:00:00Z'), env = { NODE_ENV: 'test', JWT_SECRET: 'x' } } = {}) {
    const db = baseFalsa();
    const enviados = [];
    let reloj = ahora;
    const s = crearServicio({
        db, env, ahora: () => reloj,
        enviarCorreo: async (m) => { enviados.push(m); return { ok: true }; },
    });
    const codigoDe = (i = enviados.length - 1) => enviados[i].asunto.match(/(\d{6})/)[1];
    return { s, db, enviados, codigoDe, mover: (ms) => { reloj = new Date(reloj.getTime() + ms); } };
}

test('el plan Universitario es la Caja, más barato que Emprendedor y va primero', () => {
    assert.equal(PLAN_ORDER[0], 'universitario');
    assert.equal(hasFeature('universitario', 'cajaInventario'), true);
    assert.equal(hasFeature('universitario', 'botVentas'), false);
    assert.ok(getPlan('universitario').price < getPlan('emprendedor').price);
    assert.equal(requiereCorreoUniversitario('universitario'), true);
    assert.equal(requiereCorreoUniversitario('emprendedor'), false);
});

test('reconoce correos de universidad y rechaza los gratis', () => {
    for (const ok of ['ana@unal.edu.co', 'Juan.P@correo.udea.edu.co', 'x@mit.edu', 'y@ox.ac.uk', 'z@est.eafit.edu.co']) {
        assert.equal(esCorreoUniversitario(ok, {}), true, ok);
    }
    for (const no of ['ana@gmail.com', 'ana@hotmail.com', 'x@empresa.co', 'x@edu.com.co.fake.com', 'sin-arroba', '', null]) {
        assert.equal(esCorreoUniversitario(no, {}), false, String(no));
    }
    assert.equal(esCorreoUniversitario('x@uniremington.co', {}), false);
    assert.equal(esCorreoUniversitario('x@uniremington.co', { UNIVERSITARIO_DOMINIOS_EXTRA: 'uniremington.co' }), true);
});

test('pide código, lo verifica y queda vigente un semestre; antes de eso el plan está bloqueado', async () => {
    const { s, enviados, codigoDe } = montar();
    assert.match(await s.motivoBloqueoPlan(7, 'universitario'), /verifica tu correo/);
    assert.equal(await s.motivoBloqueoPlan(7, 'emprendedor'), null);

    const r = await s.solicitarCodigo(7, '  Ana@UNAL.edu.co ', { nombreNegocio: 'Arepas <b>Ana</b>' });
    assert.equal(r.ok, true);
    assert.equal(r.correo, 'ana@unal.edu.co');
    assert.equal(enviados[0].para, 'ana@unal.edu.co');
    assert.ok(!enviados[0].html.includes('<b>Ana</b>'), 'el nombre del negocio va escapado en el HTML');
    assert.equal((await s.estado(7)).codigo_pendiente, true);

    const v = await s.verificarCodigo(7, codigoDe());
    assert.equal(v.ok, true);
    assert.equal(v.valido_hasta.slice(0, 7), '2027-05');
    assert.equal(await s.motivoBloqueoPlan(7, 'universitario'), null);
    const e = await s.estado(7);
    assert.equal(e.verificado, true);
    assert.equal(e.codigo_pendiente, false);
});

test('rechaza correos que no son de universidad sin mandar nada', async () => {
    const { s, enviados } = montar();
    assert.equal((await s.solicitarCodigo(1, 'ana@gmail.com')).codigo, 'CORREO_NO_UNIVERSITARIO');
    assert.equal((await s.solicitarCodigo(1, 'no es correo')).codigo, 'CORREO_INVALIDO');
    assert.equal(enviados.length, 0);
});

test('código equivocado: cuenta intentos y bloquea al quinto; código vencido no sirve', async () => {
    const { s, codigoDe, mover } = montar();
    await s.solicitarCodigo(2, 'b@udea.edu.co');
    const bueno = codigoDe();
    const malo = bueno === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) assert.equal((await s.verificarCodigo(2, malo)).codigo, 'CODIGO_INCORRECTO');
    assert.equal((await s.verificarCodigo(2, bueno)).codigo, 'DEMASIADOS_INTENTOS');
    assert.equal((await s.verificarCodigo(2, '12')).codigo, 'CODIGO_INVALIDO');

    await s.solicitarCodigo(2, 'b@udea.edu.co');
    mover(16 * 60000);
    assert.equal((await s.verificarCodigo(2, codigoDe())).codigo, 'CODIGO_VENCIDO');
    assert.equal(await s.vigente(2), false);
});

test('un correo verificado no sirve a otro negocio, y cambiar de correo quita la verificación', async () => {
    const { s, codigoDe } = montar();
    await s.solicitarCodigo(3, 'c@eafit.edu.co');
    assert.equal((await s.verificarCodigo(3, codigoDe())).ok, true);
    assert.equal((await s.solicitarCodigo(4, 'c@eafit.edu.co')).codigo, 'CORREO_EN_USO');

    await s.solicitarCodigo(3, 'otro@eafit.edu.co');
    assert.equal(await s.vigente(3), false, 'el correo nuevo todavía no está verificado');
});

test('máximo 5 códigos por día y negocio', async () => {
    const { s, mover } = montar();
    for (let i = 0; i < 5; i += 1) assert.equal((await s.solicitarCodigo(5, 'd@unal.edu.co')).ok, true);
    assert.equal((await s.solicitarCodigo(5, 'd@unal.edu.co')).codigo, 'DEMASIADOS_CODIGOS');
    mover(24 * 3600000);
    assert.equal((await s.solicitarCodigo(5, 'd@unal.edu.co')).ok, true);
});

test('la verificación vence a los 6 meses', async () => {
    const { s, codigoDe, mover } = montar();
    await s.solicitarCodigo(6, 'e@unal.edu.co');
    await s.verificarCodigo(6, codigoDe());
    mover(185 * 86400000);
    assert.equal(await s.vigente(6), false);
});

test('sin SMTP: en desarrollo devuelve el código; en producción avisa que no se pudo enviar', async () => {
    const sinSmtp = async () => ({ ok: false, motivo: 'sin_smtp' });
    const dev = crearServicio({ db: baseFalsa(), env: { NODE_ENV: 'development' }, enviarCorreo: sinSmtp });
    const r = await dev.solicitarCodigo(1, 'f@unal.edu.co');
    assert.equal(r.ok, true);
    assert.match(r.codigo_dev, /^\d{6}$/);
    assert.equal((await dev.verificarCodigo(1, r.codigo_dev)).ok, true);

    const prod = crearServicio({ db: baseFalsa(), env: { NODE_ENV: 'production' }, enviarCorreo: sinSmtp });
    const p = await prod.solicitarCodigo(1, 'f@unal.edu.co');
    assert.equal(p.codigo, 'CORREO_NO_ENVIADO');
    assert.equal(p.codigo_dev, undefined);
});
