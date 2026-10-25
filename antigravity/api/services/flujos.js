// Constructor de flujos: catálogo de pasos y validación del grafo. Sin base de datos: lo usan
// las rutas (api/routes/flujos.js) y el motor (flujosMotor.js). Debe mantenerse alineado con
// agency-platform-react/src/components/flujos/catalogo.js (mismos tipos y salidas).

const MAX_NODOS = 30;
const MAX_TEXTO = 500;
const MAX_CORTO = 60;
const LIMITE_FLUJOS_POR_PLAN = { emprendedor: 3, starter: 5, professional: 20, enterprise: Infinity };

const MODOS_DISPARADOR = ['palabra', 'primer_mensaje', 'pedido_pagado', 'pedido_entregado', 'cliente_inactivo'];
const EVENTOS = ['pedido_pagado', 'pedido_entregado', 'cliente_inactivo'];
const TIPOS_CONDICION = ['etiqueta', 'dato', 'gastado', 'pedidos', 'horario', 'stock'];
const ID_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;
const UNIDADES = ['minutos', 'horas', 'días'];

const texto = (v, max, def = '') => (typeof v === 'string' ? v.trim().slice(0, max) : def);

// salidas: puntos de salida válidos. espera: el paso detiene el flujo hasta que el cliente responda o pase el tiempo.
// limpiar: deja solo los campos conocidos con valores acotados.
const TIPOS = {
    disparador: {
        salidas: ['default'], espera: false,
        // modo: la palabra que escribe el cliente, su primer mensaje, o un evento del negocio (el flujo arranca solo).
        limpiar: (c = {}) => {
            const modo = MODOS_DISPARADOR.includes(c.modo) ? c.modo : 'palabra';
            const dias = Math.round(Number(c.dias));
            return { modo, palabra: texto(c.palabra, MAX_CORTO), dias: Number.isFinite(dias) ? Math.min(Math.max(dias, 1), 365) : 30 };
        },
    },
    mensaje: { salidas: ['default'], espera: false, limpiar: (c = {}) => ({ texto: texto(c.texto, MAX_TEXTO) }) },
    espera: {
        salidas: ['default'], espera: true,
        limpiar: (c = {}) => {
            const n = Math.round(Number(c.cantidad));
            return { cantidad: Number.isFinite(n) ? Math.min(Math.max(n, 1), 1440) : 10, unidad: UNIDADES.includes(c.unidad) ? c.unidad : 'minutos' };
        },
    },
    opciones: {
        salidas: ['1', '2', '3'], espera: true,
        limpiar: (c = {}) => ({ texto: texto(c.texto, MAX_TEXTO), o1: texto(c.o1, MAX_CORTO), o2: texto(c.o2, MAX_CORTO), o3: texto(c.o3, MAX_CORTO) }),
    },
    pregunta: {
        salidas: ['default'], espera: true,
        limpiar: (c = {}) => ({ texto: texto(c.texto, MAX_TEXTO), campo: texto(c.campo, 30).replace(/[^A-Za-z0-9_áéíóúñÁÉÍÓÚÑ ]/g, '') }),
    },
    etiqueta: {
        salidas: ['default'], espera: false,
        limpiar: (c = {}) => ({ accion: c.accion === 'quitar' ? 'quitar' : 'poner', nombre: normalizarEtiqueta(c.nombre) }),
    },
    // Condición con dos salidas (sí / no). `tipo` decide qué se pregunta; los flujos viejos (solo `valor`) son de etiqueta.
    condicion: {
        salidas: ['si', 'no'], espera: false,
        limpiar: (c = {}) => {
            const tipo = TIPOS_CONDICION.includes(c.tipo) ? c.tipo : 'etiqueta';
            const entero = (v, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0; };
            if (tipo === 'dato') return { tipo, campo: texto(c.campo, 30).toLowerCase(), valor: texto(c.valor, MAX_CORTO) };
            if (tipo === 'gastado') return { tipo, minimo: entero(c.minimo, 1000000000) };
            if (tipo === 'pedidos') return { tipo, minimo: entero(c.minimo, 10000) };
            if (tipo === 'stock') return { tipo, producto_id: entero(c.producto_id, 2147483647), minimo: Math.max(1, entero(c.minimo, 1000000)) };
            if (tipo === 'horario') return { tipo };
            return { tipo: 'etiqueta', valor: normalizarEtiqueta(c.valor) };
        },
    },
    // Envía los métodos de pago del negocio (Nequi / Bancolombia que configuró en Ajustes).
    info_pago: { salidas: ['default'], espera: false, limpiar: (c = {}) => ({ nota: texto(c.nota, 200) }) },
    // Pasa la conversación a otro flujo del mismo negocio y termina este.
    saltar: {
        salidas: [], espera: false,
        limpiar: (c = {}) => { const n = Math.round(Number(c.flujo_id)); return { flujo_id: Number.isFinite(n) && n > 0 ? n : 0 }; },
    },
    ia: { salidas: ['default'], espera: false, limpiar: (c = {}) => ({ instruccion: texto(c.instruccion, MAX_TEXTO) }) },
    pedido: { salidas: ['default'], espera: false, limpiar: (c = {}) => ({ cobrar: !!c.cobrar, cupon: !!c.cupon }) },
    asesor: { salidas: [], espera: false, limpiar: (c = {}) => ({ aviso: texto(c.aviso, MAX_TEXTO) }) },
};

/** Etiquetas en minúsculas, sin espacios raros, hasta 40 caracteres. */
function normalizarEtiqueta(v) {
    return String(v ?? '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_áéíóúñ]/g, '').slice(0, 40);
}

/** Texto sin tildes, minúsculas y espacios simples: para comparar lo que escribe el cliente. */
function normalizarTexto(v) {
    return String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Limpia y valida la estructura del grafo (siempre al guardar). Devuelve { definicion } o { error }.
 * No exige que esté completo: eso se pide solo al activar (validarParaActivar).
 */
function validarDefinicion(entrada) {
    if (!entrada || typeof entrada !== 'object' || !Array.isArray(entrada.nodos) || !Array.isArray(entrada.conexiones)) {
        return { error: 'El flujo no tiene un formato válido' };
    }
    if (entrada.nodos.length === 0) return { error: 'El flujo está vacío' };
    if (entrada.nodos.length > MAX_NODOS) return { error: `Un flujo puede tener hasta ${MAX_NODOS} pasos` };
    if (entrada.conexiones.length > MAX_NODOS * 3) return { error: 'Hay demasiadas conexiones' };

    const nodos = [];
    const porId = new Map();
    for (const n of entrada.nodos) {
        if (!n || typeof n.id !== 'string' || !ID_VALIDO.test(n.id)) return { error: 'Un paso tiene un identificador no válido' };
        if (porId.has(n.id)) return { error: 'Hay pasos repetidos' };
        const def = TIPOS[n.tipo];
        if (!def) return { error: `Tipo de paso no válido: ${String(n.tipo).slice(0, 20)}` };
        const x = Math.round(Number(n.x)), y = Math.round(Number(n.y));
        const limpio = {
            id: n.id, tipo: n.tipo,
            x: Number.isFinite(x) ? Math.min(Math.max(x, 0), 20000) : 0,
            y: Number.isFinite(y) ? Math.min(Math.max(y, 0), 20000) : 0,
            config: def.limpiar(n.config),
        };
        nodos.push(limpio);
        porId.set(n.id, limpio);
    }
    if (nodos.filter((n) => n.tipo === 'disparador').length !== 1) return { error: 'El flujo debe tener exactamente un disparador' };

    const conexiones = [];
    const usadas = new Set();
    for (const c of entrada.conexiones) {
        if (!c || !porId.has(c.desde) || !porId.has(c.hacia)) return { error: 'Una conexión apunta a un paso que no existe' };
        const origen = porId.get(c.desde);
        const salida = String(c.salida ?? 'default');
        if (!TIPOS[origen.tipo].salidas.includes(salida)) return { error: 'Una conexión sale de un punto que no existe' };
        if (c.desde === c.hacia) return { error: 'Un paso no puede conectarse consigo mismo' };
        if (porId.get(c.hacia).tipo === 'disparador') return { error: 'Nada puede llegar al disparador' };
        const clave = `${c.desde}|${salida}`;
        if (usadas.has(clave)) return { error: 'Una salida solo puede llevar a un paso' };
        usadas.add(clave);
        conexiones.push({ desde: c.desde, salida, hacia: c.hacia });
    }

    return { definicion: { nodos, conexiones } };
}

function siguiente(definicion, desdeId, salida = 'default') {
    const c = definicion.conexiones.find((x) => x.desde === desdeId && x.salida === salida);
    return c ? c.hacia : null;
}

/** ¿Hay un ciclo que no pase por un paso que espere al cliente o al tiempo? (bucle infinito en el mismo mensaje). */
function hayBucleSinEspera(definicion) {
    const porId = new Map(definicion.nodos.map((n) => [n.id, n]));
    const estado = new Map(); // 1 = visitando, 2 = listo
    const visitar = (id) => {
        estado.set(id, 1);
        for (const c of definicion.conexiones.filter((x) => x.desde === id)) {
            const destino = porId.get(c.hacia);
            if (TIPOS[destino.tipo].espera) continue; // un paso que espera corta el ciclo
            if (estado.get(c.hacia) === 1) return true;
            if (!estado.has(c.hacia) && visitar(c.hacia)) return true;
        }
        estado.set(id, 2);
        return false;
    };
    return definicion.nodos.some((n) => !estado.has(n.id) && !TIPOS[n.tipo].espera && visitar(n.id));
}

/** Datos del disparador para guardarlos aparte (búsqueda rápida). */
function datosDisparador(definicion) {
    const d = definicion.nodos.find((n) => n.tipo === 'disparador');
    const evento = EVENTOS.includes(d.config.modo) ? d.config.modo : null;
    return {
        palabraClave: d.config.modo === 'palabra' ? normalizarTexto(d.config.palabra).slice(0, 60) || null : null,
        primerMensaje: d.config.modo === 'primer_mensaje',
        evento,
        eventoDias: evento === 'cliente_inactivo' ? d.config.dias : null,
    };
}

/** Reglas extra para poder encender el flujo. Devuelve null si está listo o el motivo en español. */
function validarParaActivar(definicion) {
    const disp = definicion.nodos.find((n) => n.tipo === 'disparador');
    const { palabraClave, primerMensaje, evento } = datosDisparador(definicion);
    if (!palabraClave && !primerMensaje && !evento) return 'Escribe la palabra clave que inicia el flujo';
    if (!siguiente(definicion, disp.id)) return 'Conecta el disparador con el primer paso';

    const alcanzables = new Set([disp.id]);
    const cola = [disp.id];
    while (cola.length) {
        const id = cola.pop();
        for (const c of definicion.conexiones.filter((x) => x.desde === id)) {
            if (!alcanzables.has(c.hacia)) { alcanzables.add(c.hacia); cola.push(c.hacia); }
        }
    }
    if (alcanzables.size !== definicion.nodos.length) return 'Hay pasos sin conectar al resto del flujo: conéctalos o quítalos';
    if (hayBucleSinEspera(definicion)) return 'Hay un círculo sin pausa que se repetiría sin parar: agrega una espera o una pregunta';

    for (const n of definicion.nodos) {
        const c = n.config;
        if (['mensaje', 'opciones', 'pregunta'].includes(n.tipo) && !c.texto) return 'Hay un paso sin texto';
        if (n.tipo === 'opciones' && !c.o1) return 'Las opciones necesitan al menos la opción 1';
        if (n.tipo === 'etiqueta' && !c.nombre) return 'Hay un paso de etiqueta sin nombre';
        if (n.tipo === 'condicion') {
            if (c.tipo === 'etiqueta' && !c.valor) return 'Hay una condición de etiqueta sin nombre';
            if (c.tipo === 'dato' && !(c.campo && c.valor)) return 'Una condición de dato necesita el dato y el valor a comparar';
            if (c.tipo === 'stock' && !c.producto_id) return 'Una condición de stock necesita elegir el producto';
        }
        if (n.tipo === 'saltar' && !c.flujo_id) return 'Elige a qué flujo salta el paso "Pasar a otro flujo"';
        if (n.tipo === 'opciones') {
            for (const i of [1, 2, 3]) {
                if (c[`o${i}`] && !siguiente(definicion, n.id, String(i))) return `La opción ${i} ("${c[`o${i}`]}") no lleva a ningún paso`;
            }
        }
    }
    return null;
}

/** Junta los conteos de la BD en { entraron, terminaron, en_curso, con_error, abandonos: [{nodo, total}] }. */
function resumirMetricas(porEstado, abandonos) {
    const n = (estado) => Number((porEstado.find((f) => f.estado === estado) || {}).total) || 0;
    const abandonaron = abandonos.reduce((s, a) => s + Number(a.total), 0);
    return {
        entraron: porEstado.reduce((s, f) => s + Number(f.total), 0),
        terminaron: n('terminada'),
        en_curso: n('esperando_respuesta') - abandonaron + n('esperando_tiempo'),
        con_error: n('error'),
        abandonaron,
        abandonos: abandonos.map((a) => ({ nodo: a.nodo_actual, total: Number(a.total) })),
    };
}

function limiteDeFlujos(plan) {
    return LIMITE_FLUJOS_POR_PLAN[plan] ?? LIMITE_FLUJOS_POR_PLAN.emprendedor;
}

module.exports = {
    TIPOS, TIPOS_CONDICION, MODOS_DISPARADOR, EVENTOS, MAX_NODOS, validarDefinicion, validarParaActivar, siguiente, datosDisparador,
    normalizarTexto, normalizarEtiqueta, limiteDeFlujos, hayBucleSinEspera, resumirMetricas,
};
