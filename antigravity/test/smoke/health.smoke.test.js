// Smoke test: confirma que la API y el instance-manager están arriba y
// respondiendo. A diferencia de test/unit, esto SÍ necesita los servidores
// corriendo (`npm run dev:api` / `npm run dev:bot`, o el despliegue real) —
// por eso vive aparte, en su propio script `npm run test:smoke`.
const test = require('node:test');
const assert = require('node:assert/strict');

const API_URL = process.env.SMOKE_API_URL || 'http://localhost:3002';
const INSTANCE_URL = process.env.SMOKE_INSTANCE_URL || 'http://localhost:3001';

async function fetchConTimeout(url, ms = 5000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

test(`API responde en ${API_URL}/health`, async () => {
    let res;
    try {
        res = await fetchConTimeout(`${API_URL}/health`);
    } catch (e) {
        assert.fail(`No se pudo conectar a ${API_URL}/health (¿está corriendo "npm run dev:api"?): ${e.message}`);
    }
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
});

test(`instance-manager responde en ${INSTANCE_URL}/health`, async () => {
    let res;
    try {
        res = await fetchConTimeout(`${INSTANCE_URL}/health`);
    } catch (e) {
        assert.fail(`No se pudo conectar a ${INSTANCE_URL}/health (¿está corriendo "npm run dev:bot"?): ${e.message}`);
    }
    assert.equal(res.status, 200);
});
