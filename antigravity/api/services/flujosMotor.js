// Motor del constructor de flujos, SIN base de datos ni WhatsApp: recibe la definición, el estado de la
// ejecución y lo que escribió el cliente, y devuelve qué hay que hacer. Así se prueba entero con tests.
// La parte que lee/escribe la BD y manda mensajes está en instance-manager/services/flowEngine.js.
//
// Resultado de iniciar / continuar / reanudar:
//   { acciones: [{tipo:'enviar', texto} | {tipo:'etiqueta', accion, nombre} | {tipo:'asesor', aviso}],
//     ejec: { nodo_actual, estado, contexto, reanudar_en },   // estado: esperando_respuesta | esperando_tiempo | terminada | error
//     ia: string|null,        // instrucción para que la IA responda al terminar el flujo
//     fallback: boolean }     // el flujo no entendió al cliente: que responda la IA de siempre

const { siguiente, normalizarTexto } = require('./flujos');

const MAX_PASOS = 50;      // tope por pasada (anti bucle)
const MAX_INTENTOS = 3;    // respuestas no entendidas en una pregunta con opciones

const MINUTOS = { minutos: 1, horas: 60, 'días': 1440 };

const nodoPorId = (def, id) => def.nodos.find((n) => n.id === id);

/** Sustituye {nombre} (primer nombre) y {campo} capturados con preguntas. Lo desconocido se quita. */
function personalizar(textoPlano, contexto, nombreCliente) {
    const primer = String(nombreCliente || '').trim().split(/\s+/)[0] || '';
    const vars = { ...(contexto?.campos || {}), nombre: primer };
    const lleno = String(textoPlano || '').replace(/\{([\wáéíóúñ ]{1,30})\}/gi, (_, k) => String(vars[k.trim().toLowerCase()] ?? vars[k.trim()] ?? ''));
    return primer ? lleno : lleno.replace(/[ \t]+([,.!¡?¿])/g, '$1').replace(/^[,\s]+/, '').replace(/ {2,}/g, ' ');
}

function textoOpciones(c) {
    const lineas = [1, 2, 3].filter((i) => c[`o${i}`]).map((i) => `${i}. ${c[`o${i}`]}`);
    return `${c.texto}\n\n${lineas.join('\n')}`;
}

/** ¿El texto del cliente es la palabra clave del flujo? (palabra completa, sin tildes ni mayúsculas) */
function coincidePalabra(palabraClaveNormalizada, texto) {
    if (!palabraClaveNormalizada) return false;
    const t = ` ${normalizarTexto(texto)} `;
    return t.includes(` ${palabraClaveNormalizada} `);
}

function nuevoEstado(parcial) {
    return { nodo_actual: null, estado: 'terminada', contexto: {}, reanudar_en: null, ...parcial };
}

/** Recorre el flujo desde `desdeId` hasta un paso que espere o hasta terminar. */
function correr(def, desdeId, contexto, cliente, ahora) {
    const acciones = [];
    let ia = null;
    let actual = desdeId;

    for (let pasos = 0; actual && pasos < MAX_PASOS; pasos++) {
        const n = nodoPorId(def, actual);
        if (!n) break;
        const c = n.config;

        switch (n.tipo) {
            case 'mensaje':
                acciones.push({ tipo: 'enviar', texto: personalizar(c.texto, contexto, cliente.nombre) });
                actual = siguiente(def, n.id);
                break;
            case 'opciones':
                acciones.push({ tipo: 'enviar', texto: personalizar(textoOpciones(c), contexto, cliente.nombre) });
                return { acciones, ia, fallback: false, ejec: nuevoEstado({ nodo_actual: n.id, estado: 'esperando_respuesta', contexto: { ...contexto, intentos: 0 } }) };
            case 'pregunta':
                acciones.push({ tipo: 'enviar', texto: personalizar(c.texto, contexto, cliente.nombre) });
                return { acciones, ia, fallback: false, ejec: nuevoEstado({ nodo_actual: n.id, estado: 'esperando_respuesta', contexto }) };
            case 'espera': {
                const minutos = c.cantidad * (MINUTOS[c.unidad] || 1);
                const proximo = siguiente(def, n.id);
                if (!proximo) { actual = null; break; }
                return { acciones, ia, fallback: false, ejec: nuevoEstado({ nodo_actual: proximo, estado: 'esperando_tiempo', contexto, reanudar_en: new Date(ahora.getTime() + minutos * 60000) }) };
            }
            case 'etiqueta':
                acciones.push({ tipo: 'etiqueta', accion: c.accion, nombre: c.nombre });
                if (c.accion === 'quitar') cliente.etiquetas = (cliente.etiquetas || []).filter((e) => e !== c.nombre);
                else cliente.etiquetas = [...new Set([...(cliente.etiquetas || []), c.nombre])];
                actual = siguiente(def, n.id);
                break;
            case 'condicion':
                actual = siguiente(def, n.id, (cliente.etiquetas || []).includes(c.valor) ? 'si' : 'no');
                break;
            case 'ia':
                ia = c.instruccion || 'Responde con los productos y precios del negocio.';
                actual = null; // la IA responde al terminar; lo que haya después no se ejecuta
                break;
            case 'pedido':
                ia = `Ayuda al cliente a armar su pedido con los productos del negocio${c.cobrar ? ' y explícale cómo pagar' : ''}${c.cupon ? '; pregúntale si tiene un cupón de descuento' : ''}.`;
                actual = null;
                break;
            case 'asesor':
                acciones.push({ tipo: 'asesor', aviso: personalizar(c.aviso, contexto, cliente.nombre) });
                return { acciones, ia, fallback: false, ejec: nuevoEstado({ contexto }) };
            default:
                actual = null;
        }
    }

    // Si se acabó el tope de pasos con trabajo pendiente, es un error (no un final normal).
    if (actual) return { acciones, ia, fallback: false, ejec: nuevoEstado({ estado: 'error', contexto }) };
    return { acciones, ia, fallback: false, ejec: nuevoEstado({ contexto }) };
}

/** Empieza un flujo a partir del paso que sigue al disparador. */
function iniciar(def, cliente, ahora = new Date()) {
    const disp = def.nodos.find((n) => n.tipo === 'disparador');
    const primero = disp && siguiente(def, disp.id);
    if (!primero) return { acciones: [], ia: null, fallback: true, ejec: nuevoEstado() };
    return correr(def, primero, { campos: {} }, { ...cliente }, ahora);
}

/** El cliente respondió y la ejecución esperaba una respuesta. */
function continuar(def, ejec, texto, cliente, ahora = new Date()) {
    const n = nodoPorId(def, ejec.nodo_actual);
    const contexto = { campos: {}, ...(ejec.contexto || {}) };
    const c0 = { ...cliente };
    if (!n) return { acciones: [], ia: null, fallback: true, ejec: nuevoEstado({ contexto }) };

    if (n.tipo === 'pregunta') {
        const clave = (n.config.campo || '').toLowerCase();
        if (clave) contexto.campos = { ...contexto.campos, [clave]: String(texto).trim().slice(0, 200) };
        return correr(def, siguiente(def, n.id), contexto, c0, ahora);
    }

    if (n.tipo === 'opciones') {
        const t = normalizarTexto(texto);
        let elegida = null;
        for (const i of [1, 2, 3]) {
            const etiqueta = normalizarTexto(n.config[`o${i}`]);
            if (!etiqueta) continue;
            if (t === String(i) || t === etiqueta || (t.length >= 3 && etiqueta.includes(t)) || t.includes(etiqueta)) { elegida = String(i); break; }
        }
        if (elegida) return correr(def, siguiente(def, n.id, elegida), contexto, c0, ahora);

        const intentos = (contexto.intentos || 0) + 1;
        if (intentos >= MAX_INTENTOS) return { acciones: [], ia: null, fallback: true, ejec: nuevoEstado({ contexto }) };
        return {
            acciones: [{ tipo: 'enviar', texto: `No te entendí 🙈 Responde con el número de la opción:\n\n${[1, 2, 3].filter((i) => n.config[`o${i}`]).map((i) => `${i}. ${n.config[`o${i}`]}`).join('\n')}` }],
            ia: null, fallback: false,
            ejec: nuevoEstado({ nodo_actual: n.id, estado: 'esperando_respuesta', contexto: { ...contexto, intentos } }),
        };
    }

    return { acciones: [], ia: null, fallback: true, ejec: nuevoEstado({ contexto }) };
}

/** Pasó el tiempo de una espera: sigue desde el paso guardado. */
function reanudar(def, ejec, cliente, ahora = new Date()) {
    return correr(def, ejec.nodo_actual, { campos: {}, ...(ejec.contexto || {}) }, { ...cliente }, ahora);
}

module.exports = { iniciar, continuar, reanudar, coincidePalabra, personalizar, MAX_PASOS };
