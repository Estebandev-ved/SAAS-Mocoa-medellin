// Parte con base de datos del motor de flujos: busca qué flujo corresponde, guarda por dónde va cada
// cliente y aplica las acciones (mandar mensajes, etiquetas). La lógica de pasos está en flujosMotor.js.
//
// Se usa desde dos lados con distinto "enviar":
//  - instance-manager/handlers/messageHandler.js → responde por el socket de WhatsApp del cliente.
//  - api/scheduler.js → reanuda las esperas (nodo "espera") y envía por /internal/message.

const db = require('../../db/config');
const Motor = require('./flujosMotor');
const { normalizarEtiqueta } = require('./flujos');

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

/**
 * Aplica el resultado del motor. `enviar(texto)` manda un mensaje al cliente.
 * Devuelve { asesor: aviso|null, ia: instruccion|null }.
 */
async function aplicar(resultado, { negocioId, clienteId, enviar }) {
    let asesor = null;
    for (const a of resultado.acciones) {
        if (a.tipo === 'enviar') {
            if (a.texto) await enviar(a.texto);
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

/**
 * Un mensaje del cliente: continúa el flujo en curso o inicia uno si coincide con un disparador.
 * Devuelve { manejado, ia, asesor }:
 *  - manejado=true: el flujo ya respondió; el bot no debe llamar a la IA.
 *  - ia=texto: el flujo terminó y pide que la IA responda con esa instrucción.
 *  - asesor!==null: hay que derivar a una persona (aviso = lo que se le dijo al cliente).
 *  - manejado=false y sin ia: no hay flujo para este mensaje; sigue la IA de siempre.
 */
async function manejarMensaje({ negocioId, cliente, texto, esNuevo, enviar }) {
    const contexto = { negocioId, clienteId: cliente.id, enviar };
    const etiquetas = await etiquetasDe(negocioId, cliente.id);
    const datosCliente = { nombre: cliente.nombre, etiquetas };

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
        const resultado = Motor.continuar(parsear(e.definicion), { nodo_actual: e.nodo_actual, contexto: parsear(e.contexto) || {} }, texto, datosCliente);
        await guardarEjecucion(e.id, e.flujo_id, negocioId, cliente.id, resultado.ejec);
        if (resultado.fallback) return { manejado: false, ia: null, asesor: null };
        const r = await aplicar(resultado, contexto);
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
    const resultado = Motor.iniciar(parsear(elegido.definicion), datosCliente);
    await guardarEjecucion(null, elegido.id, negocioId, cliente.id, resultado.ejec);
    if (resultado.ejec.estado === 'error') console.error(`[Flujos] Flujo ${elegido.id} cortado por exceso de pasos (negocio ${negocioId})`);
    const r = await aplicar(resultado, contexto);
    // Si se cortó por error sin haber dicho nada, mejor que responda la IA que dejar al cliente sin respuesta.
    if (resultado.ejec.estado === 'error' && resultado.acciones.length === 0) return { manejado: false, ia: null, asesor: null };
    return { manejado: !r.ia, ...r };
}

/**
 * Reanuda las ejecuciones cuya espera ya venció. `enviarA(negocioId, numero, texto)` envía por WhatsApp.
 * Solo se escribe a clientes que aceptaron marketing (Ley 1581): es un mensaje que el cliente no pidió en ese momento.
 */
async function procesarEsperas(enviarA) {
    const [vencidas] = await db.execute(
        `SELECT e.id, e.flujo_id, e.negocio_id, e.cliente_id, e.nodo_actual, e.contexto, f.definicion, f.activo,
                c.nombre, c.whatsapp, c.acepta_marketing
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
            const resultado = Motor.reanudar(parsear(e.definicion), { nodo_actual: e.nodo_actual, contexto: parsear(e.contexto) || {} }, { nombre: e.nombre, etiquetas });
            await guardarEjecucion(e.id, e.flujo_id, e.negocio_id, e.cliente_id, resultado.ejec);
            const enviar = async (t) => {
                await enviarA(e.negocio_id, e.whatsapp, t);
                await db.execute(
                    "INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada) VALUES (?, ?, 'salida', ?, ?, 'flujo')",
                    [e.negocio_id, e.whatsapp, t, AGENTE_PROACTIVO]
                );
                await pausa(PAUSA_ENTRE_ENVIOS_MS);
            };
            // Desde un proceso en segundo plano no hay IA ni asesor a quien derivar: solo mensajes y etiquetas.
            await aplicar(resultado, { negocioId: e.negocio_id, clienteId: e.cliente_id, enviar });
        } catch (err) {
            console.error(`[Flujos] Error reanudando ejecución ${e.id}:`, err.message);
            await db.execute("UPDATE flujo_ejecuciones SET estado = 'error' WHERE id = ?", [e.id]).catch(() => {});
        }
    }
    return vencidas.length;
}

module.exports = { manejarMensaje, procesarEsperas, HORAS_VIGENCIA_RESPUESTA, MAX_PROACTIVOS_DIA };
