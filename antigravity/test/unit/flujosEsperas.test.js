const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const definicion = {
    nodos: [
        { id: 'a', tipo: 'disparador', x: 0, y: 0, config: { modo: 'palabra', palabra: 'x' } },
        { id: 'b', tipo: 'espera', x: 0, y: 0, config: { cantidad: 5, unidad: 'minutos' } },
        { id: 'c', tipo: 'mensaje', x: 0, y: 0, config: { texto: 'Hola {nombre}, ¿sigues interesado?' } },
    ],
    conexiones: [{ desde: 'a', salida: 'default', hacia: 'b' }, { desde: 'b', salida: 'default', hacia: 'c' }],
};

function montar({ vencidas, enviadosHoy = 0 }) {
    const log = { claims: [], postergadas: [], mensajes: [], estados: [] };
    const db = {
        async execute(sql, p = []) {
            const q = sql.replace(/\s+/g, ' ').trim();
            if (q.includes("FROM flujo_ejecuciones e JOIN flujos f JOIN clientes c") || q.includes('JOIN clientes c ON c.id = e.cliente_id')) return [vencidas];
            if (q.startsWith('SELECT COUNT(*) AS total FROM mensajes')) return [[{ total: enviadosHoy + log.mensajes.length }]];
            if (q.includes('SET reanudar_en = DATE_ADD(CURDATE()')) { log.postergadas.push(p[0]); return [{ affectedRows: 1 }]; }
            if (q.includes("SET estado = 'terminada' WHERE id = ? AND estado = 'esperando_tiempo'")) { log.claims.push(p[0]); return [{ affectedRows: 1 }]; }
            if (q.startsWith('SELECT etiqueta FROM etiquetas_cliente')) return [[]];
            if (q.startsWith('UPDATE flujo_ejecuciones SET nodo_actual')) { log.estados.push(p[1]); return [{ affectedRows: 1 }]; }
            if (q.startsWith('INSERT INTO mensajes')) { log.mensajes.push(p); return [{}]; }
            throw new Error(`Consulta no simulada: ${q.slice(0, 90)}`);
        },
    };
    const dbPath = require.resolve(path.join('..', '..', 'db', 'config'));
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
    delete require.cache[require.resolve('../../api/services/flujosEjecucion')];
    // Sin pausas reales entre envíos
    const orig = global.setTimeout; global.setTimeout = (f) => orig(f, 0);
    const mod = require('../../api/services/flujosEjecucion');
    return { mod, log, restaurar: () => { global.setTimeout = orig; } };
}

const fila = (id, extra = {}) => ({
    id, flujo_id: 1, negocio_id: 7, cliente_id: id, nodo_actual: 'c', contexto: '{}', definicion: JSON.stringify(definicion), activo: 1,
    nombre: 'Ana Gómez', whatsapp: '+573001112233', acepta_marketing: 1, ...extra,
});

test('reanuda la espera y manda el mensaje, dejándolo registrado como proactivo', async () => {
    const { mod, log, restaurar } = montar({ vencidas: [fila(1)] });
    const enviados = [];
    await mod.procesarEsperas(async (neg, num, texto) => { enviados.push([neg, num, texto]); });
    restaurar();
    assert.deepStrictEqual(enviados, [[7, '+573001112233', 'Hola Ana, ¿sigues interesado?']]);
    assert.strictEqual(log.mensajes.length, 1);
    assert.strictEqual(log.mensajes[0][3], 'flujo_proactivo');
});

test('no escribe a quien no aceptó marketing', async () => {
    const { mod, log, restaurar } = montar({ vencidas: [fila(1, { acepta_marketing: 0 })] });
    const enviados = [];
    await mod.procesarEsperas(async (...a) => { enviados.push(a); });
    restaurar();
    assert.strictEqual(enviados.length, 0);
    assert.deepStrictEqual(log.claims, [1]); // queda terminada, no se reintenta
});

test('con el tope diario alcanzado se posterga a mañana y no se envía', async () => {
    const { mod, log, restaurar } = montar({ vencidas: [fila(1), fila(2)], enviadosHoy: mod_max() });
    const enviados = [];
    await mod.procesarEsperas(async (...a) => { enviados.push(a); });
    restaurar();
    assert.strictEqual(enviados.length, 0);
    assert.deepStrictEqual(log.postergadas, [1, 2]);
    assert.deepStrictEqual(log.claims, []);
});

function mod_max() { return 100; } // = FLUJOS_MAX_PROACTIVOS_DIA por defecto
