const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { cifrarSecreto } = require('../../api/services/secretos');
const Flujos = require('../../api/services/flujos');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';

const DISPARADOR = { id: 'a', tipo: 'disparador', x: 0, y: 0, config: { modo: 'comentario_instagram', palabra: 'QUIERO', respuestas: '¡Listo, te escribí por DM! 📩\nRevisa tus mensajes 👀' } };
const flujoCatalogo = () => ({
    nodos: [
        DISPARADOR,
        { id: 'b', tipo: 'mensaje', x: 300, y: 0, config: { texto: 'Hola {nombre}, aquí está el catálogo.' } },
        { id: 'c', tipo: 'mensaje', x: 600, y: 0, config: { texto: 'Escríbeme lo que te guste.' } },
        { id: 'd', tipo: 'etiqueta', x: 900, y: 0, config: { accion: 'poner', nombre: 'pidio_catalogo' } },
    ],
    conexiones: [
        { desde: 'a', salida: 'default', hacia: 'b' },
        { desde: 'b', salida: 'default', hacia: 'c' },
        { desde: 'c', salida: 'default', hacia: 'd' },
    ],
});

// ---- validación del flujo ----
test('disparador "comentario en Instagram": guarda palabra y respuestas, se marca como evento y exige la palabra para encender', () => {
    const { definicion, error } = Flujos.validarDefinicion(flujoCatalogo());
    assert.ifError(error);
    const disp = definicion.nodos.find((n) => n.tipo === 'disparador');
    assert.strictEqual(disp.config.modo, 'comentario_instagram');
    assert.match(disp.config.respuestas, /Revisa tus mensajes/);
    const datos = Flujos.datosDisparador(definicion);
    assert.strictEqual(datos.evento, 'comentario_instagram');
    assert.strictEqual(datos.palabraClave, null);               // el DM normal no lo dispara con la palabra
    assert.strictEqual(Flujos.validarParaActivar(definicion), null);

    const sinPalabra = flujoCatalogo();
    sinPalabra.nodos[0] = { ...DISPARADOR, config: { ...DISPARADOR.config, palabra: '' } };
    assert.match(Flujos.validarParaActivar(Flujos.validarDefinicion(sinPalabra).definicion), /palabra/i);
});

// ---- webhook de comentarios ----
function montar({ flujos = [{ id: 3, definicion: JSON.stringify(flujoCatalogo()) }], enviadosHoy = 0, fetchOk = () => true } = {}) {
    const consultas = [];
    const graph = [];
    const db = {
        async execute(sql, p = []) {
            const q = sql.replace(/\s+/g, ' ').trim();
            consultas.push([q, p]);
            if (q.startsWith('SELECT id FROM negocios WHERE instagram_user_id = ?')) return [p[0] === 'IG_NEGOCIO' ? [{ id: 7 }] : []];
            if (q.startsWith('SELECT id, definicion FROM flujos')) return [flujos];
            if (q.startsWith('SELECT COUNT(*) AS total FROM mensajes')) return [[{ total: enviadosHoy }]];
            if (q.startsWith('SELECT id, nombre FROM clientes')) return [[]];
            if (q.startsWith('INSERT INTO clientes')) return [{ insertId: 55 }];
            if (q.startsWith('SELECT etiqueta FROM etiquetas_cliente')) return [[]];
            if (q.startsWith('INSERT INTO flujo_ejecuciones')) return [{ insertId: 1 }];
            if (q.startsWith('SELECT id FROM conversaciones')) return [[]];
            if (q.startsWith('SELECT instagram_token FROM negocios')) return [[{ instagram_token: cifrarSecreto('TOKEN-REAL') }]];
            return [{}];
        },
    };
    const reemplazar = (ruta, exportado) => { const r = require.resolve(ruta); require.cache[r] = { id: r, filename: r, loaded: true, exports: exportado }; };
    reemplazar(path.join('..', '..', 'db', 'config'), db);
    reemplazar('../../api/middleware/auth', { verificarAuth: (q, r, n) => n() });
    global.fetch = async (url, op) => {
        graph.push({ url, cuerpo: JSON.parse(op.body) });
        const ok = fetchOk(url);
        return { ok, status: ok ? 200 : 400, json: async () => ({ error: { message: 'No se pudo' } }) };
    };
    delete require.cache[require.resolve('../../api/services/flujosEjecucion')];   // que use la base simulada de esta prueba
    delete require.cache[require.resolve('../../api/routes/instagram')];
    const router = require('../../api/routes/instagram');
    return { comentar: router.handleInstagramComment, consultas, graph };
}

const comentario = (extra = {}) => ({ id: 'COM_1', text: 'Yo quiero el catálogo!', from: { id: 'CLIENTE_9', username: 'maria.shop' }, media: { id: 'POST_1' }, ...extra });

test('comentario con la palabra: respuesta privada con el flujo, comentario público variado y etiqueta puesta', async () => {
    const { comentar, graph, consultas } = montar();
    await comentar(comentario(), 'IG_NEGOCIO');

    assert.strictEqual(graph.length, 2);
    const [privada, publica] = graph;
    assert.match(privada.url, /\/me\/messages\?access_token=TOKEN-REAL$/);
    assert.deepStrictEqual(privada.cuerpo.recipient, { comment_id: 'COM_1' });
    assert.match(privada.cuerpo.message.text, /Hola maria\.shop, aquí está el catálogo\.\n\nEscríbeme lo que te guste\./);   // los pasos se juntan en un solo DM
    assert.match(publica.url, /\/COM_1\/replies\?access_token=TOKEN-REAL$/);
    assert.ok(['¡Listo, te escribí por DM! 📩', 'Revisa tus mensajes 👀'].includes(publica.cuerpo.message));

    const insertCliente = consultas.find(([q]) => q.startsWith('INSERT INTO clientes'));
    assert.deepStrictEqual(insertCliente[1], [7, 'maria.shop', 'ig_CLIENTE_9']);
    assert.ok(consultas.some(([q, p]) => q.startsWith('INSERT IGNORE INTO etiquetas_cliente') && p.includes('pidio_catalogo')));
    assert.ok(consultas.some(([q]) => q.startsWith('INSERT INTO flujo_ejecuciones')));
    assert.ok(consultas.some(([q]) => q.startsWith('INSERT INTO conversaciones')));                          // aparece en Mensajes
    assert.ok(consultas.some(([q, p]) => q.includes("INSERT INTO mensajes") && p.includes('flujo_proactivo')));   // cuenta para el tope diario
});

test('comentario: ignora los propios, los sin palabra, cuentas desconocidas, textos vacíos y los repetidos', async () => {
    const { comentar, graph } = montar();
    await comentar(comentario({ from: { id: 'IG_NEGOCIO', username: 'mi.tienda' } }), 'IG_NEGOCIO');   // nuestra propia respuesta
    await comentar(comentario({ id: 'COM_2', text: 'Qué bonito 😍' }), 'IG_NEGOCIO');                       // sin la palabra
    await comentar(comentario({ id: 'COM_3' }), 'OTRA_CUENTA');                                           // cuenta no conectada
    await comentar(comentario({ id: 'COM_4', text: '' }), 'IG_NEGOCIO');
    await comentar(null, 'IG_NEGOCIO');
    assert.strictEqual(graph.length, 0);

    await comentar(comentario({ id: 'COM_5' }), 'IG_NEGOCIO');
    await comentar(comentario({ id: 'COM_5' }), 'IG_NEGOCIO');                                            // Meta reintenta el aviso
    assert.strictEqual(graph.length, 2);                                                                  // una sola respuesta privada + una pública
});

test('comentario: sin flujos que coincidan o con el tope diario alcanzado no se escribe a nadie', async () => {
    const otraPalabra = flujoCatalogo();
    otraPalabra.nodos[0] = { ...DISPARADOR, config: { ...DISPARADOR.config, palabra: 'PRECIO' } };
    const a = montar({ flujos: [{ id: 4, definicion: JSON.stringify(otraPalabra) }] });
    await a.comentar(comentario(), 'IG_NEGOCIO');
    assert.strictEqual(a.graph.length, 0);

    const orig = console.warn; console.warn = () => {};
    try {
        const b = montar({ enviadosHoy: 100 });
        await b.comentar(comentario(), 'IG_NEGOCIO');
        assert.strictEqual(b.graph.length, 0);
    } finally { console.warn = orig; }
});

test('comentario: si la respuesta privada falla no se anuncia "te escribimos por privado" en público', async () => {
    const orig = console.error; console.error = () => {};
    try {
        const { comentar, graph } = montar({ fetchOk: (url) => !url.includes('/me/messages') });
        await comentar(comentario(), 'IG_NEGOCIO');
        assert.strictEqual(graph.length, 1);
        assert.match(graph[0].url, /\/me\/messages/);
    } finally { console.error = orig; }
});

test('comentario: sin respuestas configuradas usa un texto por defecto', async () => {
    const f = flujoCatalogo();
    f.nodos[0] = { ...DISPARADOR, config: { ...DISPARADOR.config, respuestas: '' } };
    const { comentar, graph } = montar({ flujos: [{ id: 5, definicion: JSON.stringify(f) }] });
    await comentar(comentario(), 'IG_NEGOCIO');
    assert.match(graph[1].cuerpo.message, /por privado/);
});
