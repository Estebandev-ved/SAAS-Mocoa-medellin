const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// Base de datos simulada en memoria: reconoce solo las consultas que hace flujosEjecucion.js.
function crearBd() {
    const bd = { flujos: [], ejec: [], etiquetas: [], sigId: 1 };
    const db = {
        async execute(sql, p = []) {
            const q = sql.replace(/\s+/g, ' ').trim();
            if (q.startsWith('SELECT etiqueta FROM etiquetas_cliente')) return [bd.etiquetas.filter((e) => e.n === p[0] && e.c === p[1]).map((e) => ({ etiqueta: e.t }))];
            if (q.includes("FROM flujo_ejecuciones e JOIN flujos f") && q.includes("'esperando_respuesta'")) {
                const filas = bd.ejec.filter((e) => e.negocio_id === p[0] && e.cliente_id === p[1] && e.estado === 'esperando_respuesta')
                    .map((e) => ({ ...e, ...bd.flujos.find((f) => f.id === e.flujo_id) , id: e.id }));
                return [filas.slice(-1)];
            }
            if (q.startsWith('SELECT id, definicion, palabra_clave, primer_mensaje FROM flujos')) return [bd.flujos.filter((f) => f.negocio_id === p[0] && f.activo)];
            if (q.startsWith('UPDATE flujo_ejecuciones SET estado = \'terminada\' WHERE negocio_id')) {
                bd.ejec.filter((e) => e.negocio_id === p[0] && e.cliente_id === p[1] && ['esperando_respuesta', 'esperando_tiempo'].includes(e.estado)).forEach((e) => { e.estado = 'terminada'; });
                return [{ affectedRows: 1 }];
            }
            if (q.startsWith('INSERT INTO flujo_ejecuciones')) {
                const [flujo_id, negocio_id, cliente_id, nodo_actual, estado, contexto, reanudar_en] = p;
                const e = { id: bd.sigId++, flujo_id, negocio_id, cliente_id, nodo_actual, estado, contexto, reanudar_en };
                bd.ejec.push(e);
                return [{ insertId: e.id }];
            }
            if (q.startsWith('UPDATE flujo_ejecuciones SET nodo_actual')) {
                const e = bd.ejec.find((x) => x.id === p[4]);
                Object.assign(e, { nodo_actual: p[0], estado: p[1], contexto: p[2], reanudar_en: p[3] });
                return [{ affectedRows: 1 }];
            }
            if (q.startsWith('INSERT IGNORE INTO etiquetas_cliente')) {
                if (!bd.etiquetas.some((e) => e.n === p[0] && e.c === p[1] && e.t === p[2])) bd.etiquetas.push({ n: p[0], c: p[1], t: p[2] });
                return [{}];
            }
            throw new Error(`Consulta no simulada: ${q.slice(0, 80)}`);
        },
    };
    return { bd, db };
}

const dbPath = require.resolve(path.join('..', '..', 'db', 'config'));
function cargar(db) {
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
    delete require.cache[require.resolve('../../api/services/flujosEjecucion')];
    return require('../../api/services/flujosEjecucion');
}

const definicion = {
    nodos: [
        { id: 'a', tipo: 'disparador', x: 0, y: 0, config: { modo: 'palabra', palabra: 'promo' } },
        { id: 'b', tipo: 'opciones', x: 0, y: 0, config: { texto: '¿Qué quieres?', o1: 'Pedir', o2: 'Etiquetarme', o3: '' } },
        { id: 'c', tipo: 'ia', x: 0, y: 0, config: { instruccion: 'Toma el pedido.' } },
        { id: 'd', tipo: 'etiqueta', x: 0, y: 0, config: { accion: 'poner', nombre: 'interesado' } },
    ],
    conexiones: [{ desde: 'a', salida: 'default', hacia: 'b' }, { desde: 'b', salida: '1', hacia: 'c' }, { desde: 'b', salida: '2', hacia: 'd' }],
};

test('sin flujos activos no se mete: sigue la IA', async () => {
    const { db } = crearBd();
    const { manejarMensaje } = cargar(db);
    const r = await manejarMensaje({ negocioId: 1, cliente: { id: 5, nombre: 'Ana' }, texto: 'hola', esNuevo: false, enviar: async () => { throw new Error('no debe enviar'); } });
    assert.deepStrictEqual(r, { manejado: false, ia: null, asesor: null });
});

test('palabra clave inicia el flujo, la respuesta continúa y el cierre pide a la IA', async () => {
    const { bd, db } = crearBd();
    bd.flujos.push({ id: 10, negocio_id: 1, activo: 1, definicion: JSON.stringify(definicion), palabra_clave: 'promo', primer_mensaje: 0 });
    const { manejarMensaje } = cargar(db);
    const enviados = [];
    const enviar = async (t) => { enviados.push(t); };
    const cliente = { id: 5, nombre: 'Ana Gómez' };

    const r1 = await manejarMensaje({ negocioId: 1, cliente, texto: 'Quiero la PROMO', esNuevo: false, enviar });
    assert.strictEqual(r1.manejado, true);
    assert.match(enviados[0], /¿Qué quieres\?\n\n1\. Pedir\n2\. Etiquetarme/);
    assert.strictEqual(bd.ejec[0].estado, 'esperando_respuesta');

    const r2 = await manejarMensaje({ negocioId: 1, cliente, texto: '1', esNuevo: false, enviar });
    assert.strictEqual(r2.manejado, false);
    assert.strictEqual(r2.ia, 'Toma el pedido.');
    assert.strictEqual(bd.ejec[0].estado, 'terminada');

    // terminada: un mensaje normal ya no lo captura el flujo
    const r3 = await manejarMensaje({ negocioId: 1, cliente, texto: 'gracias', esNuevo: false, enviar });
    assert.deepStrictEqual(r3, { manejado: false, ia: null, asesor: null });
});

test('la etiqueta se guarda sin duplicarse', async () => {
    const { bd, db } = crearBd();
    bd.flujos.push({ id: 10, negocio_id: 1, activo: 1, definicion: JSON.stringify(definicion), palabra_clave: 'promo', primer_mensaje: 0 });
    const { manejarMensaje } = cargar(db);
    const cliente = { id: 5, nombre: 'Ana' };
    for (let i = 0; i < 2; i++) {
        await manejarMensaje({ negocioId: 1, cliente, texto: 'promo', esNuevo: false, enviar: async () => {} });
        await manejarMensaje({ negocioId: 1, cliente, texto: '2', esNuevo: false, enviar: async () => {} });
    }
    assert.strictEqual(bd.etiquetas.length, 1);
    assert.strictEqual(bd.etiquetas[0].t, 'interesado');
});

test('un flujo de otro negocio no se dispara', async () => {
    const { bd, db } = crearBd();
    bd.flujos.push({ id: 10, negocio_id: 2, activo: 1, definicion: JSON.stringify(definicion), palabra_clave: 'promo', primer_mensaje: 0 });
    const { manejarMensaje } = cargar(db);
    const r = await manejarMensaje({ negocioId: 1, cliente: { id: 5, nombre: 'Ana' }, texto: 'promo', esNuevo: false, enviar: async () => {} });
    assert.strictEqual(r.manejado, false);
});
