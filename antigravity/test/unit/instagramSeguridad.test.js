const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { firmaValida, firmar } = require('../../api/services/metaWebhook');
const { cifrarSecreto, descifrarSecreto, estaCifrado } = require('../../api/services/secretos');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';

test('firma de Meta: acepta la correcta y rechaza cuerpo alterado, secreto distinto o cabecera rara', () => {
    const cuerpo = Buffer.from('{"object":"instagram","entry":[]}');
    const ok = firmar(cuerpo, 'app-secret');
    assert.strictEqual(firmaValida(cuerpo, ok, 'app-secret'), true);
    assert.strictEqual(firmaValida(Buffer.from('{"object":"instagram","entry":[1]}'), ok, 'app-secret'), false);
    assert.strictEqual(firmaValida(cuerpo, ok, 'otro-secreto'), false);
    for (const mala of [undefined, '', 'sha256=zzz', 'md5=' + 'a'.repeat(32), ok.slice(0, -2)]) assert.strictEqual(firmaValida(cuerpo, mala, 'app-secret'), false);
    assert.strictEqual(firmaValida(undefined, ok, 'app-secret'), false);
    assert.strictEqual(firmaValida(cuerpo, ok, ''), false);
});

test('secretos: ida y vuelta, no repite el cifrado, lee valores viejos en texto plano y no explota con basura', () => {
    const token = 'EAAG' + 'x'.repeat(200);
    const a = cifrarSecreto(token);
    const b = cifrarSecreto(token);
    assert.ok(estaCifrado(a) && a !== b);                 // IV distinto cada vez
    assert.ok(!a.includes('xxxx'));                        // no queda nada legible
    assert.strictEqual(descifrarSecreto(a), token);
    assert.strictEqual(descifrarSecreto(token), token);   // dato viejo sin cifrar
    assert.strictEqual(descifrarSecreto(null), null);
    assert.strictEqual(cifrarSecreto(''), null);
    const orig = console.error; console.error = () => {};
    try {
        assert.strictEqual(descifrarSecreto('enc:v1:00:00:00'), null);
        assert.strictEqual(descifrarSecreto(a.slice(0, -4) + 'ffff'), null);   // alterado → falla la autenticación
    } finally { console.error = orig; }
});

// ---- webhook de Instagram ----
function montar() {
    const consultas = [];
    const enviados = [];
    const db = {
        async execute(sql, p = []) {
            const q = sql.replace(/\s+/g, ' ').trim();
            consultas.push([q, p]);
            if (q.startsWith('SELECT id FROM negocios WHERE instagram_user_id = ?')) return [p[0] === 'IG_NEGOCIO' ? [{ id: 7 }] : []];
            if (q.startsWith('SELECT id FROM clientes')) return [[]];
            if (q.startsWith('SELECT id FROM conversaciones')) return [[]];
            if (q.startsWith('INSERT INTO conversaciones')) return [{ insertId: 90 }];
            if (q.startsWith('INSERT INTO clientes')) return [{ insertId: 55 }];
            if (q.startsWith('SELECT tipo, contenido FROM mensajes')) return [[]];
            if (q.startsWith('SELECT instagram_token FROM negocios')) return [[{ instagram_token: cifrarSecreto('TOKEN-REAL') }]];
            return [{}];
        },
    };
    const reemplazar = (ruta, exportado) => { const p = require.resolve(ruta); require.cache[p] = { id: p, filename: p, loaded: true, exports: exportado }; };
    reemplazar(path.join('..', '..', 'db', 'config'), db);
    reemplazar('../../api/middleware/auth', { verificarAuth: (q, r, n) => n() });
    reemplazar('../../instance-manager/agents/orchestrator', { procesarMensaje: async () => ({ respuesta: '¡Hola!', agente_usado: 'ventas', intencion: 'saludo' }) });
    global.fetch = async (url, opciones) => { enviados.push({ url, cuerpo: JSON.parse(opciones.body) }); return { ok: true, json: async () => ({}) }; };
    delete require.cache[require.resolve('../../api/routes/instagram')];
    const router = require('../../api/routes/instagram');
    const post = router.stack.find((l) => l.route && l.route.path === '/webhook' && l.route.methods.post).route.stack[0].handle;
    return { post, router, consultas, enviados };
}

function llamar(post, cuerpoObj, { firma, secreto } = {}) {
    const raw = Buffer.from(JSON.stringify(cuerpoObj));
    const cabeceras = {};
    if (firma !== undefined) cabeceras['x-hub-signature-256'] = firma === true ? firmar(raw, secreto) : firma;
    const req = { body: cuerpoObj, rawBody: raw, headers: cabeceras, get: (h) => cabeceras[h.toLowerCase()] };
    const res = { estado: null, status(c) { this.estado = c; return this; }, send() { return this; }, sendStatus(c) { this.estado = c; return this; } };
    return post(req, res).then(() => res);
}

const evento = (extra = {}) => ({
    object: 'instagram',
    entry: [{ id: 'IG_NEGOCIO', messaging: [{ sender: { id: 'CLIENTE_123' }, recipient: { id: 'IG_NEGOCIO' }, message: { text: 'Hola, ¿tienen disponible?' }, ...extra }] }],
});

test('webhook: con META_APP_SECRET exige firma válida y no procesa nada si falla', async () => {
    process.env.META_APP_SECRET = 'app-secret';
    const { post, consultas, enviados } = montar();
    assert.strictEqual((await llamar(post, evento())).estado, 403);                              // sin firma
    assert.strictEqual((await llamar(post, evento(), { firma: 'sha256=' + 'a'.repeat(64) })).estado, 403);   // firma falsa
    assert.strictEqual(consultas.length, 0);
    assert.strictEqual(enviados.length, 0);
    assert.strictEqual((await llamar(post, evento(), { firma: true, secreto: 'app-secret' })).estado, 200);
    assert.ok(enviados.length === 1);
    delete process.env.META_APP_SECRET;
});

test('webhook: en producción sin META_APP_SECRET se rechaza; en desarrollo pasa', async () => {
    delete process.env.META_APP_SECRET;
    const previo = process.env.NODE_ENV;
    const { post } = montar();
    process.env.NODE_ENV = 'production';
    const orig = console.error; console.error = () => {};
    try { assert.strictEqual((await llamar(post, evento())).estado, 403); } finally { console.error = orig; process.env.NODE_ENV = previo; }
    assert.strictEqual((await llamar(post, evento())).estado, 200);
});

test('mensaje: el negocio se identifica por la cuenta que recibe, responde con el token descifrado y usa un id de cliente corto', async () => {
    delete process.env.META_APP_SECRET;
    const { post, consultas, enviados } = montar();
    await llamar(post, evento());
    const busqueda = consultas.find(([q]) => q.startsWith('SELECT id FROM negocios WHERE instagram_user_id'));
    assert.deepStrictEqual(busqueda[1], ['IG_NEGOCIO']);                  // antes buscaba por quien ENVÍA (nunca coincidía)
    assert.strictEqual(enviados.length, 1);
    assert.match(enviados[0].url, /access_token=TOKEN-REAL$/);             // el token cifrado se descifra al usarlo
    assert.deepStrictEqual(enviados[0].cuerpo.recipient, { id: 'CLIENTE_123' });
    assert.ok(consultas.some(([q]) => q.startsWith('INSERT INTO conversaciones')));   // aparece en la pantalla Mensajes
    const insertCliente = consultas.find(([q]) => q.startsWith('INSERT INTO clientes'));
    assert.ok(insertCliente[1][2].length <= 20, `whatsapp demasiado largo: ${insertCliente[1][2]}`);
});

test('mensaje: ignora ecos propios, cuentas desconocidas y mensajes sin texto', async () => {
    delete process.env.META_APP_SECRET;
    const { post, enviados } = montar();
    await llamar(post, evento({ message: { text: 'Hola', is_echo: true } }));
    const desconocida = evento(); desconocida.entry[0].id = 'OTRA_CUENTA'; desconocida.entry[0].messaging[0].recipient.id = 'OTRA_CUENTA';
    await llamar(post, desconocida);
    await llamar(post, evento({ message: { attachments: [{ type: 'image' }] } }));
    assert.strictEqual(enviados.length, 0);
});
