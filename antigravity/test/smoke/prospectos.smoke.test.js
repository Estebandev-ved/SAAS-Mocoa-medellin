// Smoke test del registro de prospectos contra la API real (necesita API + MySQL y
// haber corrido `node db/migrate_prospectos.js`). Crea y borra su propio prospecto.
const test = require('node:test');
const assert = require('node:assert/strict');

const API = process.env.SMOKE_API_URL || 'http://localhost:3002';
const ADMIN = { email: process.env.SMOKE_ADMIN_EMAIL || 'admin@antigravity.co', password: process.env.SMOKE_ADMIN_PASSWORD || 'Test2024#' };
const NO_ADMIN = { email: 'demo@antigravity.co', password: 'Demo2024#' };

async function login(cred) {
    const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cred) });
    return (await r.json()).token;
}
const llamar = (token, ruta, opts = {}) =>
    fetch(`${API}/api/admin/prospectos${ruta}`, {
        ...opts,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

test('registro de prospectos: ciclo completo', async (t) => {
    const token = await login(ADMIN);
    assert.ok(token, `no se pudo iniciar sesión como admin (${ADMIN.email})`);
    let id;

    await t.test('un negocio que no es admin recibe 403', async () => {
        const tokenNegocio = await login(NO_ADMIN);
        const r = await llamar(tokenNegocio, '');
        assert.equal(r.status, 403);
    });

    await t.test('crear: valida y normaliza el WhatsApp', async () => {
        const mal = await llamar(token, '', { method: 'POST', body: { nombre_negocio: 'Smoke', whatsapp: '123' } });
        assert.equal(mal.status, 400);
        const r = await llamar(token, '', { method: 'POST', body: { nombre_negocio: `Smoke ${Date.now()}`, contacto: 'Ana Pérez', whatsapp: '300 555 1234', video_url: 'https://youtu.be/smoke' } });
        assert.equal(r.status, 201);
        const { prospecto } = await r.json();
        assert.equal(prospecto.whatsapp, '573005551234');
        assert.equal(prospecto.estado, 'nuevo');
        id = prospecto.id;
    });

    await t.test('listar: aparece y los conteos incluyen su estado', async () => {
        const r = await llamar(token, '?estado=nuevo');
        const d = await r.json();
        assert.ok(d.prospectos.some((p) => p.id === id));
        assert.ok(d.stats.por_estado.nuevo >= 1);
    });

    await t.test('editar parcialmente y rechazar estado inválido', async () => {
        const ok = await llamar(token, `/${id}`, { method: 'PUT', body: { estado: 'respondio', notas: 'le gustó' } });
        assert.equal((await ok.json()).prospecto.estado, 'respondio');
        const mal = await llamar(token, `/${id}`, { method: 'PUT', body: { estado: 'inventado' } });
        assert.equal(mal.status, 400);
    });

    await t.test('marcar enviado: guarda el contacto y no retrocede un estado avanzado', async () => {
        const r = await llamar(token, `/${id}/marcar-enviado`, { method: 'POST' });
        const { prospecto } = await r.json();
        assert.equal(prospecto.estado, 'respondio');
        assert.ok(prospecto.ultimo_contacto_at);
        assert.ok(prospecto.proximo_seguimiento);
    });

    await t.test('eliminar y 404 la segunda vez', async () => {
        assert.equal((await llamar(token, `/${id}`, { method: 'DELETE' })).status, 200);
        assert.equal((await llamar(token, `/${id}`, { method: 'DELETE' })).status, 404);
    });
});
