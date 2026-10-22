// Simulador de flujos ("Probar flujo" en el editor): corre el MISMO motor que el bot pero en memoria,
// sin base de datos y sin enviar nada. El estado viaja de ida y vuelta con el navegador (sin sesión en el servidor).

const F = require('./flujos');
const M = require('./flujosMotor');

const MAX_TEXTO = 500;
const MAX_ETIQUETAS = 50;
const MAX_CONTEXTO_BYTES = 5000;

/** Estado de la ejecución que manda el navegador: solo se aceptan campos esperados y acotados. */
function sanearEjec(e) {
    if (!e || typeof e !== 'object') return null;
    if (!['esperando_respuesta', 'esperando_tiempo'].includes(e.estado)) return null;
    if (typeof e.nodo_actual !== 'string') return null;
    let contexto = e.contexto && typeof e.contexto === 'object' && !Array.isArray(e.contexto) ? e.contexto : {};
    if (JSON.stringify(contexto).length > MAX_CONTEXTO_BYTES) contexto = {};
    return { nodo_actual: e.nodo_actual.slice(0, 40), estado: e.estado, contexto };
}

function sanearEtiquetas(lista) {
    if (!Array.isArray(lista)) return [];
    return [...new Set(lista.filter((t) => typeof t === 'string').map(F.normalizarEtiqueta).filter(Boolean))].slice(0, MAX_ETIQUETAS);
}

/** Convierte lo que devolvió el motor en líneas de chat para mostrar y actualiza las etiquetas simuladas. */
function aMensajes(resultado, etiquetas) {
    const mensajes = [];
    let tags = [...etiquetas];
    for (const a of resultado.acciones) {
        if (a.tipo === 'enviar') mensajes.push({ de: 'bot', texto: a.texto });
        else if (a.tipo === 'etiqueta') {
            tags = a.accion === 'quitar' ? tags.filter((t) => t !== a.nombre) : [...new Set([...tags, a.nombre])];
            mensajes.push({ de: 'sistema', texto: `🏷️ ${a.accion === 'quitar' ? 'Se quita' : 'Se pone'} la etiqueta "${a.nombre}"` });
        } else if (a.tipo === 'asesor') {
            if (a.aviso) mensajes.push({ de: 'bot', texto: a.aviso });
            mensajes.push({ de: 'sistema', texto: '🙋 Aquí el chat pasaría a una persona y el bot dejaría de responder' });
        }
    }
    if (resultado.ia) mensajes.push({ de: 'sistema', texto: `🤖 Aquí responde la IA del negocio con esta instrucción: "${resultado.ia}"` });
    if (resultado.fallback) mensajes.push({ de: 'sistema', texto: '🤖 El flujo no entendió: responde la IA de siempre' });
    if (resultado.ejec.estado === 'error') mensajes.push({ de: 'sistema', texto: '⚠️ El flujo se cortó por tener demasiados pasos seguidos' });
    if (resultado.ejec.estado === 'esperando_tiempo') mensajes.push({ de: 'sistema', texto: '⏳ El flujo espera un rato antes de seguir. Usa "Saltar la espera" para ver qué pasa después' });
    if (resultado.ejec.estado === 'terminada' && !resultado.ia && !resultado.fallback) mensajes.push({ de: 'sistema', texto: '✅ Fin del flujo' });
    return { mensajes, etiquetas: tags };
}

/**
 * Un paso del simulador.
 *  entrada: { definicion, modo: 'mensaje' | 'saltar_espera', texto, ejec, etiquetas, nombre }
 *  salida:  { mensajes, ejec, etiquetas } o { error }
 */
function simular(entrada) {
    const v = F.validarDefinicion(entrada && entrada.definicion);
    if (v.error) return { error: v.error };
    const def = v.definicion;
    const etiquetas = sanearEtiquetas(entrada.etiquetas);
    const cliente = { nombre: typeof entrada.nombre === 'string' ? entrada.nombre.trim().slice(0, 60) : '', etiquetas };
    const ejec = sanearEjec(entrada.ejec);
    const texto = typeof entrada.texto === 'string' ? entrada.texto.trim().slice(0, MAX_TEXTO) : '';

    let resultado;
    if (entrada.modo === 'saltar_espera') {
        if (!ejec || ejec.estado !== 'esperando_tiempo') return { error: 'No hay ninguna espera para saltar' };
        resultado = M.reanudar(def, ejec, cliente);
    } else {
        if (!texto) return { error: 'Escribe un mensaje' };
        if (ejec && ejec.estado === 'esperando_respuesta') {
            resultado = M.continuar(def, ejec, texto, cliente);
        } else {
            const { palabraClave, primerMensaje } = F.datosDisparador(def);
            const inicia = (palabraClave && M.coincidePalabra(palabraClave, texto)) || (primerMensaje && !entrada.yaHablo);
            if (!inicia) {
                return {
                    mensajes: [{ de: 'sistema', texto: palabraClave ? `Este mensaje no inicia el flujo (la palabra clave es "${palabraClave}"): respondería la IA de siempre` : 'Este mensaje no inicia el flujo: respondería la IA de siempre' }],
                    ejec: null, etiquetas,
                };
            }
            resultado = M.iniciar(def, cliente);
        }
    }

    const { mensajes, etiquetas: nuevas } = aMensajes(resultado, etiquetas);
    const sigue = ['esperando_respuesta', 'esperando_tiempo'].includes(resultado.ejec.estado);
    return {
        mensajes,
        etiquetas: nuevas,
        ejec: sigue ? { nodo_actual: resultado.ejec.nodo_actual, estado: resultado.ejec.estado, contexto: resultado.ejec.contexto } : null,
    };
}

module.exports = { simular };
