// Parte con base de datos del motor de flujos: busca qué flujo corresponde, guarda por dónde va cada
// cliente y aplica las acciones (mandar mensajes, etiquetas). La lógica de pasos está en flujosMotor.js.
//
// Se usa desde tres lados:
//  - instance-manager/handlers/messageHandler.js → responde por el socket de WhatsApp del cliente.
//  - api/scheduler.js → reanuda las esperas, revisa clientes inactivos y envía por /internal/message.
//  - api/routes/orders.js y otros → avisan eventos del negocio (pedido pagado, pedido entregado).

const db = require('../../db/config');
const Motor = require('./flujosMotor');
const { normalizarEtiqueta, normalizarTexto, EVENTO_COMENTARIO } = require('./flujos');
const { dentroDeHorario } = require('./horario');

// Cuántos flujos puede encadenar un "Pasar a otro flujo" (evita ciclos entre flujos que se llaman entre sí).
const MAX_SALTOS = 3;
// Una ejecución que espera respuesta y lleva más de esto sin actividad se descarta: no se le "roba"
// el chat al cliente que escribe otra cosa al día siguiente.
const HORAS_VIGENCIA_RESPUESTA = 24;
const PAUSA_ENTRE_ENVIOS_MS = 2000;
// Tope de mensajes que los flujos escriben por su cuenta (sin que el cliente haya escrito justo antes) por negocio y día:
// con WhatsApp por QR, las ráfagas a gente que no escribió primero son la causa típica de bloqueo del número.
const MAX_PROACTIVOS_DIA = Number.parseInt(process.env.FLUJOS_MAX_PROACTIVOS_DIA, 10) > 0 ? Number.parseInt(process.env.FLUJOS_MAX_PROACTIVOS_DIA, 10) : 100;
const AGENTE_PROACTIVO = 'flujo_proactivo';

async function enviadosHoy(negocioId) {
    const [r] = await db.execute(
        "SELECT COUNT(*) AS total FROM mensajes WHERE negocio_id = ? AND agente_proceso = ? AND created_at >= CURDATE()",
        [negocioId, AGENTE_PROACTIVO]
    );
    return Number(r[0].total) || 0;
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const parsear = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

async function etiquetasDe(negocioId, clienteId) {
    const [filas] = await db.execute('SELECT etiqueta FROM etiquetas_cliente WHERE negocio_id = ? AND cliente_id = ?', [negocioId, clienteId]);
    return filas.map((f) => f.etiqueta);
}

async function guardarEjecucion(ejecId, flujoId, negocioId, clienteId, ejec) {
    const contexto = JSON.stringify(ejec.contexto || {});
    if (ejecId) {
        await db.execute(
            'UPDATE flujo_ejecuciones SET nodo_actual = ?, estado = ?, contexto = ?, reanudar_en = ? WHERE id = ?',
            [ejec.nodo_actual, ejec.estado, contexto, ejec.reanudar_en, ejecId]
        );
        return ejecId;
    }
    const [r] = await db.execute(
        'INSERT INTO flujo_ejecuciones (flujo_id, negocio_id, cliente_id, nodo_actual, estado, contexto, reanudar_en) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [flujoId, negocioId, clienteId, ejec.nodo_actual, ejec.estado, contexto, ejec.reanudar_en]
    );
    return r.insertId;
}

/** Datos del cliente que necesitan las condiciones del flujo; solo se consulta lo que el flujo usa. */
async function datosDelCliente(def, negocioId, cliente, etiquetas) {
    const datos = {
        nombre: cliente.nombre, etiquetas,
        total_gastado: Number(cliente.total_gastado) || 0, total_pedidos: Number(cliente.total_pedidos) || 0,
    };
    const condiciones = def.nodos.filter((n) => n.tipo === 'condicion');
    if (condiciones.some((n) => n.config.tipo === 'horario')) {
        const [n] = await db.execute('SELECT horario_activo_inicio, horario_activo_fin FROM negocios WHERE id = ?', [negocioId]);
        datos.dentroHorario = n.length ? dentroDeHorario(n[0].horario_activo_inicio, n[0].horario_activo_fin) : true;
    }
    const ids = [...new Set(condiciones.filter((n) => n.config.tipo === 'stock' && n.config.producto_id).map((n) => n.config.producto_id))];
    if (ids.length) {
        const [filas] = await db.execute(
            `SELECT id, stock, controla_stock FROM productos WHERE negocio_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
            [negocioId, ...ids]
        );
        datos.stock = {};
        // Un producto que no controla inventario siempre "tiene stock" (se vende sin límite).
        for (const f of filas) datos.stock[f.id] = f.controla_stock ? Number(f.stock) : null;
    }
    return datos;
}

/** Texto con los métodos de pago que el dueño configuró en Ajustes. */
async function textoInfoPago(negocioId, nota) {
    const [n] = await db.execute('SELECT numero_nequi, numero_bancolombia FROM negocios WHERE id = ?', [negocioId]);
    const { numero_nequi: nequi, numero_bancolombia: banco } = n[0] || {};
    let t = '💳 *Métodos de pago:*\n';
    if (nequi) t += `📱 Nequi: *${nequi}*\n`;
    if (banco) t += `🏦 Bancolombia: *${banco}*\n`;
    if (!nequi && !banco) t += 'Escríbenos y te contamos las opciones de pago.\n';
    if (nota) t += `\n${nota}`;
    return t.trim();
}

/**
 * Aplica el resultado del motor. `enviar(texto)` manda un mensaje al cliente.
 * Devuelve { asesor: aviso|null, ia: instruccion|null }.
 */
async function aplicar(resultado, { negocioId, clienteId, enviar }) {
    let asesor = null;
    for (const a of resultado.acciones) {
        if (a.tipo === 'enviar') {
            if (a.texto) await enviar(a.texto);
        } else if (a.tipo === 'info_pago') {
            await enviar(await textoInfoPago(negocioId, a.nota));
        } else if (a.tipo === 'etiqueta' && a.nombre) {
            const nombre = normalizarEtiqueta(a.nombre);
            if (a.accion === 'quitar') {
                await db.execute('DELETE FROM etiquetas_cliente WHERE negocio_id = ? AND cliente_id = ? AND etiqueta = ?', [negocioId, clienteId, nombre]);
            } else {
                await db.execute('INSERT IGNORE INTO etiquetas_cliente (negocio_id, cliente_id, etiqueta) VALUES (?, ?, ?)', [negocioId, clienteId, nombre]);
            }
        } else if (a.tipo === 'asesor') {
            asesor = a.aviso || '';
        }
    }
    return { asesor, ia: resultado.ia || null };
}

/** Aplica el resultado y, si el flujo pidió "pasar a otro flujo", arranca ese (hasta MAX_SALTOS veces). */
async function finalizar(resultado, ctx, cliente, profundidad) {
    if (resultado.ejec.estado === 'error') console.error(`[Flujos] Un flujo se cortó por exceso de pasos (negocio ${ctx.negocioId})`);
    const r = await aplicar(resultado, ctx);
    if (resultado.saltar && profundidad < MAX_SALTOS) {
        const [dest] = await db.execute('SELECT id, definicion FROM flujos WHERE id = ? AND negocio_id = ? AND activo = 1', [resultado.saltar, ctx.negocioId]);
        if (dest.length > 0) {
            const r2 = await iniciarFlujo(dest[0], ctx, cliente, profundidad + 1);
            return { asesor: r2.asesor ?? r.asesor, ia: r2.ia ?? r.ia };
        }
    }
    return r;
}

/** Empieza un flujo para este cliente (el estado queda guardado) y aplica lo que le toca hacer. */
async function iniciarFlujo(flujo, ctx, cliente, profundidad = 0) {
    const def = parsear(flujo.definicion);
    const datos = await datosDelCliente(def, ctx.negocioId, cliente, cliente.etiquetas || []);
    const resultado = Motor.iniciar(def, datos);
    await guardarEjecucion(null, flujo.id, ctx.negocioId, ctx.clienteId, resultado.ejec);
    const r = await finalizar(resultado, ctx, cliente, profundidad);
    // Si se cortó por error sin haber dicho nada, mejor que responda la IA que dejar al cliente sin respuesta.
    if (resultado.ejec.estado === 'error' && resultado.acciones.length === 0) return { sinRespuesta: true, asesor: null, ia: null };
    return r;
}

/**
 * Un mensaje del cliente: continúa el flujo en curso o inicia uno si coincide con un disparador.
 * Devuelve { manejado, ia, asesor }:
 *  - manejado=true: el flujo ya respondió; el bot no debe llamar a la IA.
 *  - ia=texto: el flujo terminó y pide que la IA responda con esa instrucción.
 *  - asesor!==null: hay que derivar a una persona (aviso = lo que se le dijo al cliente).
 *  - manejado=false y sin ia: no hay flujo para este mensaje; sigue la IA de siempre.
 */
async function manejarMensaje({ negocioId, cliente, texto, esNuevo, enviar }) {
    const ctx = { negocioId, clienteId: cliente.id, enviar };
    const etiquetas = await etiquetasDe(negocioId, cliente.id);
    const clienteConEtiquetas = { ...cliente, etiquetas };

    // 1) ¿Hay un flujo esperando la respuesta de este cliente?
    const [pend] = await db.execute(
        `SELECT e.*, f.definicion, f.activo FROM flujo_ejecuciones e JOIN flujos f ON f.id = e.flujo_id
         WHERE e.negocio_id = ? AND e.cliente_id = ? AND e.estado = 'esperando_respuesta'
           AND e.updated_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
         ORDER BY e.id DESC LIMIT 1`,
        [negocioId, cliente.id, HORAS_VIGENCIA_RESPUESTA]
    );
    if (pend.length > 0 && pend[0].activo) {
        const e = pend[0];
        const def = parsear(e.definicion);
        const datos = await datosDelCliente(def, negocioId, cliente, etiquetas);
        const resultado = Motor.continuar(def, { nodo_actual: e.nodo_actual, contexto: parsear(e.contexto) || {} }, texto, datos);
        await guardarEjecucion(e.id, e.flujo_id, negocioId, cliente.id, resultado.ejec);
        if (resultado.fallback) return { manejado: false, ia: null, asesor: null };
        const r = await finalizar(resultado, ctx, clienteConEtiquetas, 0);
        return { manejado: !r.ia, ...r };
    }

    // 2) ¿El mensaje inicia algún flujo activo?
    const [flujos] = await db.execute(
        'SELECT id, definicion, palabra_clave, primer_mensaje FROM flujos WHERE negocio_id = ? AND activo = 1 ORDER BY id',
        [negocioId]
    );
    const elegido = flujos.find((f) => (f.palabra_clave && Motor.coincidePalabra(f.palabra_clave, texto)) || (f.primer_mensaje && esNuevo));
    if (!elegido) return { manejado: false, ia: null, asesor: null };

    // Un flujo nuevo reemplaza cualquier ejecución abierta de este cliente.
    await db.execute(
        "UPDATE flujo_ejecuciones SET estado = 'terminada' WHERE negocio_id = ? AND cliente_id = ? AND estado IN ('esperando_respuesta', 'esperando_tiempo')",
        [negocioId, cliente.id]
    );
    const r = await iniciarFlujo(elegido, ctx, clienteConEtiquetas, 0);
    if (r.sinRespuesta) return { manejado: false, ia: null, asesor: null };
    return { manejado: !r.ia, ...r };
}

/** Envío "proactivo" (el cliente no acaba de escribir): lo registra y deja una pausa para no hacer ráfagas. */
function crearEnviarProactivo(enviarA, negocioId, whatsapp) {
    return async (t) => {
        await enviarA(negocioId, whatsapp, t);
        await db.execute(
            "INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada) VALUES (?, ?, 'salida', ?, ?, 'flujo')",
            [negocioId, whatsapp, t, AGENTE_PROACTIVO]
        );
        await pausa(PAUSA_ENTRE_ENVIOS_MS);
    };
}

/**
 * Reanuda las ejecuciones cuya espera ya venció. `enviarA(negocioId, numero, texto)` envía por WhatsApp.
 * Solo se escribe a clientes que aceptaron marketing (Ley 1581): es un mensaje que el cliente no pidió en ese momento.
 */
async function procesarEsperas(enviarA) {
    const [vencidas] = await db.execute(
        `SELECT e.id, e.flujo_id, e.negocio_id, e.cliente_id, e.nodo_actual, e.contexto, f.definicion, f.activo,
                c.nombre, c.whatsapp, c.acepta_marketing, c.total_gastado, c.total_pedidos
         FROM flujo_ejecuciones e
         JOIN flujos f ON f.id = e.flujo_id
         JOIN clientes c ON c.id = e.cliente_id
         WHERE e.estado = 'esperando_tiempo' AND e.reanudar_en <= NOW()
         ORDER BY e.reanudar_en LIMIT 20`
    );
    const topeAlcanzado = new Set(); // negocios que ya llegaron al tope en esta pasada
    for (const e of vencidas) {
        if (topeAlcanzado.has(e.negocio_id) || (await enviadosHoy(e.negocio_id)) >= MAX_PROACTIVOS_DIA) {
            // Se posterga a mañana: no se pierde ni se reintenta cada 30 s.
            topeAlcanzado.add(e.negocio_id);
            await db.execute("UPDATE flujo_ejecuciones SET reanudar_en = DATE_ADD(CURDATE(), INTERVAL 1 DAY) WHERE id = ? AND estado = 'esperando_tiempo'", [e.id]);
            continue;
        }
        // Reclamo atómico: si otra pasada ya la tomó, no se repite.
        const [claim] = await db.execute("UPDATE flujo_ejecuciones SET estado = 'terminada' WHERE id = ? AND estado = 'esperando_tiempo'", [e.id]);
        if (claim.affectedRows === 0) continue;
        if (!e.activo || !e.acepta_marketing || !e.whatsapp) continue; // flujo apagado o sin permiso: queda terminada

        try {
            const etiquetas = await etiquetasDe(e.negocio_id, e.cliente_id);
            const def = parsear(e.definicion);
            const cliente = { nombre: e.nombre, total_gastado: e.total_gastado, total_pedidos: e.total_pedidos, etiquetas };
            const datos = await datosDelCliente(def, e.negocio_id, cliente, etiquetas);
            const resultado = Motor.reanudar(def, { nodo_actual: e.nodo_actual, contexto: parsear(e.contexto) || {} }, datos);
            await guardarEjecucion(e.id, e.flujo_id, e.negocio_id, e.cliente_id, resultado.ejec);
            // Desde un proceso en segundo plano no hay IA ni asesor a quien derivar: solo mensajes, etiquetas y saltos de flujo.
            await finalizar(resultado, { negocioId: e.negocio_id, clienteId: e.cliente_id, enviar: crearEnviarProactivo(enviarA, e.negocio_id, e.whatsapp) }, cliente, 0);
        } catch (err) {
            console.error(`[Flujos] Error reanudando ejecución ${e.id}:`, err.message);
            await db.execute("UPDATE flujo_ejecuciones SET estado = 'error' WHERE id = ?", [e.id]).catch(() => {});
        }
    }
    return vencidas.length;
}

// ---------- Disparadores por evento ----------

/** Arranca un flujo para un cliente desde un proceso en segundo plano (sin que acabe de escribir). */
async function iniciarProactivo(flujo, cliente, negocioId, enviarA) {
    const etiquetas = await etiquetasDe(negocioId, cliente.id);
    const ctx = { negocioId, clienteId: cliente.id, enviar: crearEnviarProactivo(enviarA, negocioId, cliente.whatsapp) };
    return iniciarFlujo(flujo, ctx, { ...cliente, etiquetas }, 0);
}

/**
 * Un evento del negocio (p. ej. 'pedido_pagado', 'pedido_entregado') para un cliente: arranca los flujos activos que lo
 * usan de disparador. Igual que las esperas, solo escribe a quien aceptó marketing, respeta el tope diario y no repite
 * el mismo flujo con el mismo cliente en 24 horas.
 */
async function dispararEvento({ negocioId, clienteId, evento, enviarA }) {
    const [flujos] = await db.execute('SELECT id, definicion FROM flujos WHERE negocio_id = ? AND activo = 1 AND evento = ?', [negocioId, evento]);
    if (flujos.length === 0) return 0;
    const [cl] = await db.execute(
        'SELECT id, nombre, whatsapp, acepta_marketing, total_gastado, total_pedidos FROM clientes WHERE id = ? AND negocio_id = ?',
        [clienteId, negocioId]
    );
    if (cl.length === 0 || !cl[0].acepta_marketing || !cl[0].whatsapp) return 0;
    let iniciados = 0;
    for (const f of flujos) {
        if ((await enviadosHoy(negocioId)) >= MAX_PROACTIVOS_DIA) break;
        const [reciente] = await db.execute(
            'SELECT id FROM flujo_ejecuciones WHERE flujo_id = ? AND cliente_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) LIMIT 1',
            [f.id, clienteId]
        );
        if (reciente.length > 0) continue;
        await iniciarProactivo(f, cl[0], negocioId, enviarA);
        iniciados++;
    }
    return iniciados;
}

/** Igual que dispararEvento, partiendo de un pedido. Nunca lanza: un flujo roto no debe tumbar el cambio de estado del pedido. */
async function dispararEventoPedido({ negocioId, pedidoId, evento, enviarA }) {
    try {
        const [p] = await db.execute('SELECT cliente_id FROM pedidos WHERE id = ? AND negocio_id = ?', [pedidoId, negocioId]);
        if (p.length === 0) return 0;
        return await dispararEvento({ negocioId, clienteId: p[0].cliente_id, evento, enviarA });
    } catch (e) {
        console.error(`[Flujos] Error disparando "${evento}":`, e.message);
        return 0;
    }
}

/**
 * Flujos con disparador "cliente inactivo": busca clientes que aceptaron marketing, compraron alguna vez y llevan N días
 * sin comprar, y que no han pasado por ese flujo en los últimos 30 días. Pocos por pasada (se reparte en el tiempo).
 */
async function revisarInactivos(enviarA) {
    const [flujos] = await db.execute("SELECT id, negocio_id, definicion, evento_dias FROM flujos WHERE activo = 1 AND evento = 'cliente_inactivo'");
    let iniciados = 0;
    for (const f of flujos) {
        const dias = Number(f.evento_dias) > 0 ? Number(f.evento_dias) : 30;
        const [clientes] = await db.execute(
            `SELECT c.id, c.nombre, c.whatsapp, c.acepta_marketing, c.total_gastado, c.total_pedidos
             FROM clientes c
             JOIN (SELECT cliente_id, MAX(created_at) AS ultimo FROM pedidos WHERE negocio_id = ? GROUP BY cliente_id) p ON p.cliente_id = c.id
             WHERE c.negocio_id = ? AND c.acepta_marketing = 1 AND c.whatsapp IS NOT NULL AND p.ultimo < DATE_SUB(NOW(), INTERVAL ? DAY)
               AND NOT EXISTS (SELECT 1 FROM flujo_ejecuciones e WHERE e.flujo_id = ? AND e.cliente_id = c.id AND e.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))
             LIMIT 10`,
            [f.negocio_id, f.negocio_id, dias, f.id]
        );
        for (const c of clientes) {
            if ((await enviadosHoy(f.negocio_id)) >= MAX_PROACTIVOS_DIA) break;
            try {
                await iniciarProactivo(f, c, f.negocio_id, enviarA);
                iniciados++;
            } catch (e) {
                console.error(`[Flujos] Error con cliente inactivo ${c.id} (flujo ${f.id}):`, e.message);
            }
        }
    }
    return iniciados;
}

// ---------- Comentarios de Instagram ----------

/** Primer flujo activo cuyo disparador "Comentario en Instagram" coincide con el texto. Devuelve { flujo, respuestas[] } o null. */
async function buscarFlujoPorComentario(negocioId, texto) {
    const [flujos] = await db.execute('SELECT id, definicion FROM flujos WHERE negocio_id = ? AND activo = 1 AND evento = ? ORDER BY id', [negocioId, EVENTO_COMENTARIO]);
    for (const f of flujos) {
        const disp = (parsear(f.definicion).nodos || []).find((n) => n.tipo === 'disparador');
        if (disp && Motor.coincidePalabra(normalizarTexto(disp.config.palabra), texto)) {
            const respuestas = String(disp.config.respuestas || '').split('\n').map((t) => t.trim()).filter(Boolean);
            return { flujo: f, respuestas };
        }
    }
    return null;
}

/** Arranca un flujo para un cliente que acaba de comentar. `enviar(texto)` recoge lo que el flujo quiere decir. */
async function iniciarParaCliente(flujo, { negocioId, cliente, enviar }) {
    await db.execute(
        "UPDATE flujo_ejecuciones SET estado = 'terminada' WHERE negocio_id = ? AND cliente_id = ? AND estado IN ('esperando_respuesta', 'esperando_tiempo')",
        [negocioId, cliente.id]
    );
    const etiquetas = await etiquetasDe(negocioId, cliente.id);
    return iniciarFlujo(flujo, { negocioId, clienteId: cliente.id, enviar }, { ...cliente, etiquetas }, 0);
}

module.exports = {
    buscarFlujoPorComentario, iniciarParaCliente, enviadosHoy,
    manejarMensaje, procesarEsperas, dispararEvento, dispararEventoPedido, revisarInactivos,
    HORAS_VIGENCIA_RESPUESTA, MAX_PROACTIVOS_DIA, MAX_SALTOS,
};
