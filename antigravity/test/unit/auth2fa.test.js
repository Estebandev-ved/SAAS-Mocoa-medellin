// Flujo completo de 2FA contra el router real, con una "base de datos" en memoria
// (sin MySQL): login en dos pasos, activar, códigos de respaldo, reuso y bloqueo.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
process.env.JWT_SECRET = 'test-secret-2fa';
process.env.NODE_ENV = 'test';

const bcrypt = require('bcryptjs');
const negocio = {
    id: 1, nombre: 'Tienda', email_dueno: 'dueno@test.co', plan: 'starter', rol: 'negocio', activo: 1,
    password: bcrypt.hashSync('Clave2026x', 4), cuenta_bloqueada: 0, intentos_login_fallidos: 0,
    totp_secret: null, totp_activo: 0, totp_backup_codes: null, totp_ultimo_paso: null, avatar_config: null,
};

// Pool falso: interpreta solo las consultas que usan auth.js y el middleware verificarAuth.
const fakePool = {
    async query(sql, params = []) {
        const q = sql.replace(/\s+/g, ' ').trim();
        if (/^SELECT .* FROM negocios WHERE email_dueno = \?/.test(q)) return [[params[0] === negocio.email_dueno ? { ...negocio } : undefined].filter(Boolean)];
        if (/^SELECT .* FROM negocios WHERE id = \?/.test(q)) return [[{ ...negocio }]];
        if (/FROM negocio_modulos/.test(q)) return [[]];
        let m;
        if ((m = q.match(/^UPDATE negocios SET intentos_login_fallidos = \?, cuenta_bloqueada = true/))) { negocio.intentos_login_fallidos = params[0]; negocio.cuenta_bloqueada = 1; return [{ affectedRows: 1 }]; }
        if (/^UPDATE negocios SET intentos_login_fallidos = \? WHERE/.test(q)) { negocio.intentos_login_fallidos = params[0]; return [{ affectedRows: 1 }]; }
        if (/^UPDATE negocios SET intentos_login_fallidos = 0, ultimo_login/.test(q)) { negocio.intentos_login_fallidos = 0; return [{ affectedRows: 1 }]; }
        if (/^UPDATE negocios SET totp_ultimo_paso = \? WHERE id = \? AND/.test(q)) {
            if (negocio.totp_ultimo_paso === null || negocio.totp_ultimo_paso < params[0]) { negocio.totp_ultimo_paso = params[0]; return [{ affectedRows: 1 }]; }
            return [{ affectedRows: 0 }];
        }
        if (/^UPDATE negocios SET totp_backup_codes = \? WHERE id = \? AND totp_backup_codes = \?/.test(q)) {
            if (negocio.totp_backup_codes === params[2]) { negocio.totp_backup_codes = params[0]; return [{ affectedRows: 1 }]; }
            return [{ affectedRows: 0 }];
        }
        if (/^UPDATE negocios SET totp_backup_codes = \? WHERE id = \?/.test(q)) { negocio.totp_backup_codes = params[0]; return [{ affectedRows: 1 }]; }
        if (/^UPDATE negocios SET totp_secret = \?, totp_activo = false/.test(q)) { negocio.totp_secret = params[0]; negocio.totp_activo = 0; negocio.totp_ultimo_paso = null; return [{ affectedRows: 1 }]; }
        if (/^UPDATE negocios SET totp_activo = true/.test(q)) { negocio.totp_activo = 1; negocio.totp_backup_codes = params[0]; negocio.totp_ultimo_paso = params[1]; return [{ affectedRows: 1 }]; }
        if (/^UPDATE negocios SET totp_activo = false, totp_secret = NULL/.test(q)) { Object.assign(negocio, { totp_activo: 0, totp_secret: null, totp_backup_codes: null, totp_ultimo_paso: null }); return [{ affectedRows: 1 }]; }
        throw new Error('Consulta no soportada por el pool falso: ' + q);
    },
};
fakePool.execute = async (sql, params) => {
    if (/FROM negocios WHERE id = \?/.test(sql)) return [[{ ...negocio }]];
    return fakePool.query(sql, params);
};
const dbPath = require.resolve(path.join(__dirname, '../../db/config'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };
// El correo no debe salir en tests.
const mailPath = require.resolve(path.join(__dirname, '../../queue/workers/emailWorker'));
require.cache[mailPath] = { id: mailPath, filename: mailPath, loaded: true, exports: { sendEmail: async () => ({}) } };

const express = require('express');
const totp = require('../../api/services/totp');
let server, base;

test.before(async () => {
    const app = express();
    app.set('trust proxy', 'loopback'); // permite variar X-Forwarded-For por petición
    app.use(express.json());
    app.use('/api/auth', require('../../api/routes/auth'));
    await new Promise(r => { server = app.listen(0, r); });
    base = `http://127.0.0.1:${server.address().port}/api/auth`;
});
test.after(() => server.close());

let ipN = 0; // una IP distinta por petición para no agotar los rate limits reales
const post = async (ruta, body, token) => {
    const r = await fetch(base + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}`, ...(token && { Authorization: `Bearer ${token}` }) }, body: JSON.stringify(body) });
    return { status: r.status, data: await r.json() };
};
const login = () => post('/login', { email: negocio.email_dueno, password: 'Clave2026x' });

let sesion, secreto, respaldo;

test('sin 2FA el login entrega sesión directo', async () => {
    const r = await login();
    assert.equal(r.status, 200);
    assert.ok(r.data.token);
    sesion = r.data.token;
});

test('setup + activar con código correcto devuelve 8 códigos de respaldo', async () => {
    const s = await post('/2fa/setup', {}, sesion);
    assert.equal(s.status, 200);
    secreto = s.data.secreto;
    assert.match(s.data.otpauth_url, /^otpauth:\/\/totp\//);
    assert.notEqual(negocio.totp_secret, secreto, 'el secreto no debe guardarse en claro');

    const mal = await post('/2fa/activar', { codigo: '000000' }, sesion);
    assert.equal(mal.status, 401);

    const ok = await post('/2fa/activar', { codigo: totp.codigoEnPaso(secreto, totp.pasoActual()) }, sesion);
    assert.equal(ok.status, 200);
    assert.equal(ok.data.codigos_respaldo.length, 8);
    respaldo = ok.data.codigos_respaldo;
    assert.ok(!negocio.totp_backup_codes.includes(respaldo[0]), 'los respaldos se guardan solo como hash');
});

test('con 2FA activo la contraseña sola NO da sesión y el token intermedio no sirve como sesión', async () => {
    const r = await login();
    assert.equal(r.status, 200);
    assert.equal(r.data.requiere_2fa, true);
    assert.equal(r.data.token, undefined);
    const uso = await post('/2fa/desactivar', {}, r.data.token_2fa);
    assert.equal(uso.status, 401);
});

test('segundo paso: código viejo reusado se rechaza; uno de respaldo funciona una sola vez', async () => {
    // El paso actual ya se consumió al activar, así que debe rechazarse (anti-reuso).
    let r = await login();
    let c = await post('/login/2fa', { token_2fa: r.data.token_2fa, codigo: totp.codigoEnPaso(secreto, totp.pasoActual()) });
    assert.equal(c.status, 401);
    assert.equal(c.data.codigo, 'CODIGO_2FA_INVALIDO');

    // Código del paso siguiente (dentro de la ventana de ±1) sí vale.
    r = await login();
    c = await post('/login/2fa', { token_2fa: r.data.token_2fa, codigo: totp.codigoEnPaso(secreto, totp.pasoActual() + 1) });
    assert.equal(c.status, 200);
    assert.ok(c.data.token);
    sesion = c.data.token;

    r = await login();
    c = await post('/login/2fa', { token_2fa: r.data.token_2fa, codigo: respaldo[0] });
    assert.equal(c.status, 200);
    r = await login();
    c = await post('/login/2fa', { token_2fa: r.data.token_2fa, codigo: respaldo[0] });
    assert.equal(c.status, 401, 'un código de respaldo no se puede reusar');
});

test('desactivar exige contraseña y código', async () => {
    const sinCodigo = await post('/2fa/desactivar', { password: 'Clave2026x', codigo: '123456' }, sesion);
    assert.equal(sinCodigo.status, 401);
    const mala = await post('/2fa/desactivar', { password: 'otra', codigo: respaldo[1] }, sesion);
    assert.equal(mala.status, 401);
    const ok = await post('/2fa/desactivar', { password: 'Clave2026x', codigo: respaldo[1] }, sesion);
    assert.equal(ok.status, 200);
    assert.equal(negocio.totp_activo, 0);
    assert.equal(negocio.totp_secret, null);
});

test('5 códigos 2FA incorrectos bloquean la cuenta', async () => {
    Object.assign(negocio, { intentos_login_fallidos: 0, cuenta_bloqueada: 0 });
    const s = await post('/2fa/setup', {}, (await login()).data.token);
    const sec = s.data.secreto;
    const sesionNueva = (await login()).data.token;
    await post('/2fa/activar', { codigo: totp.codigoEnPaso(sec, totp.pasoActual() + 1) }, sesionNueva);
    assert.equal(negocio.totp_activo, 1);
    const { data } = await login();
    let ultimo;
    for (let i = 0; i < 5; i++) ultimo = await post('/login/2fa', { token_2fa: data.token_2fa, codigo: '111111' });
    assert.equal(ultimo.status, 403);
    assert.equal(negocio.cuenta_bloqueada, 1);
});
