// Smoke test: login real contra la API y una ruta protegida con el token que
// devuelve — confirma que JWT_SECRET, la conexión a MySQL y el middleware de
// autenticación funcionan juntos de punta a punta.
const test = require('node:test');
const assert = require('node:assert/strict');

const API_URL = process.env.SMOKE_API_URL || 'http://localhost:3002';
// Cuenta demo documentada en el README (seed.sql) — no es una cuenta de cliente real.
const EMAIL = process.env.SMOKE_LOGIN_EMAIL || 'demo@antigravity.co';
const PASSWORD = process.env.SMOKE_LOGIN_PASSWORD || 'Demo2024#';

test('login con la cuenta demo devuelve un token válido', async () => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    assert.equal(res.status, 200, `login falló con status ${res.status} — revisa que la cuenta demo (${EMAIL}) siga existiendo con esa contraseña`);
    const data = await res.json();
    assert.ok(data.token, 'la respuesta de login no trajo token');
    assert.ok(data.negocio?.id, 'la respuesta de login no trajo el negocio');

    // El token debe servir de verdad para una ruta protegida.
    const perfil = await fetch(`${API_URL}/api/business/perfil`, {
        headers: { Authorization: `Bearer ${data.token}` },
    });
    assert.equal(perfil.status, 200, 'el token del login no sirvió para una ruta protegida');
});

test('login con credenciales incorrectas se rechaza (no debe devolver token nunca)', async () => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: 'contraseña-incorrecta-a-proposito' }),
    });
    assert.notEqual(res.status, 200);
    const data = await res.json();
    assert.ok(!data.token, 'nunca debería devolver un token con la contraseña equivocada');
});
