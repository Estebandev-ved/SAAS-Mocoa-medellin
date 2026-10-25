// Plantillas de flujos listas para usar: el dueño elige una, la ajusta (textos, palabra clave) y la enciende.
// Todas se prueban en test/unit/flujosPlantillas.test.js: son válidas y se pueden encender tal cual.
// `familias` = a qué tipos de negocio se recomienda (las familias de tiposNegocio.js); [] = a todos.

const COL = 290;
const FILA = 130;
const N = (id, tipo, col, fila, config = {}) => ({ id, tipo, x: 40 + col * COL, y: 40 + fila * FILA, config });
const C = (desde, salida, hacia) => ({ desde, salida, hacia });

const PLANTILLAS = [
    {
        id: 'promo', nombre: 'Promoción por palabra clave', familias: [],
        descripcion: 'El cliente escribe PROMO y recibe tu oferta con opciones para pedir, ver el menú o que le recuerdes más tarde.',
        definicion: {
            nodos: [
                N('d', 'disparador', 0, 0, { modo: 'palabra', palabra: 'PROMO' }),
                N('m', 'mensaje', 1, 0, { texto: '¡Hola {nombre}! 🎉 Esta semana tenemos una promoción especial para ti.' }),
                N('o', 'opciones', 2, 0, { texto: '¿Te animas?', o1: 'Quiero pedir', o2: 'Ver el menú', o3: 'Más tarde' }),
                N('p', 'pedido', 3, 0, { cobrar: true }),
                N('i', 'ia', 3, 1, { instruccion: 'Muestra los productos con sus precios y pregunta qué le gustaría pedir.' }),
                N('e', 'etiqueta', 3, 2, { accion: 'poner', nombre: 'recordar_promo' }),
                N('g', 'mensaje', 4, 2, { texto: 'Listo, te escribo más adelante. ¡Gracias!' }),
            ],
            conexiones: [C('d', 'default', 'm'), C('m', 'default', 'o'), C('o', '1', 'p'), C('o', '2', 'i'), C('o', '3', 'e'), C('e', 'default', 'g')],
        },
    },
    {
        id: 'menu', nombre: 'Menú y pedidos', familias: ['restaurante', 'retail'],
        descripcion: 'Quien escribe "menú" ve las opciones: conocer los productos, hacer un pedido o hablar con una persona.',
        definicion: {
            nodos: [
                N('d', 'disparador', 0, 0, { modo: 'palabra', palabra: 'menu' }),
                N('m', 'mensaje', 1, 0, { texto: '¡Hola {nombre}! 👋 Bienvenido. ¿En qué te ayudo hoy?' }),
                N('o', 'opciones', 2, 0, { texto: 'Elige una opción:', o1: 'Ver el menú', o2: 'Hacer un pedido', o3: 'Hablar con una persona' }),
                N('i', 'ia', 3, 0, { instruccion: 'Muestra el menú o catálogo con precios, ordenado por categoría.' }),
                N('p', 'pedido', 3, 1, { cobrar: true, cupon: true }),
                N('a', 'asesor', 3, 2, { aviso: 'Claro, te paso con una persona del equipo. 🙌' }),
            ],
            conexiones: [C('d', 'default', 'm'), C('m', 'default', 'o'), C('o', '1', 'i'), C('o', '2', 'p'), C('o', '3', 'a')],
        },
    },
    {
        id: 'horario', nombre: 'Horarios y ubicación', familias: [],
        descripcion: 'Responde si estás abierto o cerrado según el horario que configuraste, y comparte dirección y datos de contacto.',
        definicion: {
            nodos: [
                N('d', 'disparador', 0, 0, { modo: 'palabra', palabra: 'horario' }),
                N('k', 'condicion', 1, 0, { tipo: 'horario' }),
                N('s', 'mensaje', 2, 0, { texto: '¡Estamos abiertos ahora! 🟢' }),
                N('n', 'mensaje', 2, 1, { texto: 'Ahora mismo estamos cerrados 🔴, pero con gusto te atendemos en nuestro próximo horario.' }),
                N('i', 'ia', 3, 0, { instruccion: 'Comparte el horario de atención, la dirección y las formas de contacto del negocio.' }),
                N('j', 'ia', 3, 1, { instruccion: 'Comparte el horario de atención y dile que le responderemos en cuanto abramos.' }),
            ],
            conexiones: [C('d', 'default', 'k'), C('k', 'si', 's'), C('k', 'no', 'n'), C('s', 'default', 'i'), C('n', 'default', 'j')],
        },
    },
    {
        id: 'captura', nombre: 'Captura de interesados', familias: ['servicios', 'educacion', 'inmobiliaria', 'otro'],
        descripcion: 'Pide nombre e interés, marca al cliente como "interesado" y pasa la conversación a una persona.',
        definicion: {
            nodos: [
                N('d', 'disparador', 0, 0, { modo: 'palabra', palabra: 'info' }),
                N('p1', 'pregunta', 1, 0, { texto: '¡Hola! Para ayudarte mejor, ¿cómo te llamas?', campo: 'nombre_cliente' }),
                N('p2', 'pregunta', 2, 0, { texto: 'Mucho gusto, {nombre_cliente} 🙌 ¿Qué te interesa conocer?', campo: 'interes' }),
                N('e', 'etiqueta', 3, 0, { accion: 'poner', nombre: 'interesado' }),
                N('m', 'mensaje', 4, 0, { texto: 'Gracias, {nombre_cliente}. Anotamos que te interesa: {interes}.' }),
                N('a', 'asesor', 5, 0, { aviso: 'Una persona del equipo te escribe en breve con toda la información. 🙌' }),
            ],
            conexiones: [C('d', 'default', 'p1'), C('p1', 'default', 'p2'), C('p2', 'default', 'e'), C('e', 'default', 'm'), C('m', 'default', 'a')],
        },
    },
    {
        id: 'seguimiento', nombre: 'Seguimiento a quien pide información', familias: ['retail', 'servicios', 'restaurante'],
        descripcion: 'Cuando alguien pide una cotización, le respondes y, si pasan 2 horas, le escribes para ayudarle a decidir (solo a quien aceptó marketing).',
        definicion: {
            nodos: [
                N('d', 'disparador', 0, 0, { modo: 'palabra', palabra: 'cotizar' }),
                N('p', 'pregunta', 1, 0, { texto: '¡Claro! ¿Qué producto o servicio te interesa?', campo: 'interes' }),
                N('m', 'mensaje', 2, 0, { texto: 'Perfecto, anoté que te interesa {interes}. En un momento te comparto los detalles.' }),
                N('e', 'etiqueta', 3, 0, { accion: 'poner', nombre: 'cotizando' }),
                N('w', 'espera', 4, 0, { cantidad: 2, unidad: 'horas' }),
                N('s', 'mensaje', 5, 0, { texto: 'Hola {nombre} 😊 ¿Pudiste revisar la información de {interes}? Si quieres, te ayudo a completar tu pedido.' }),
            ],
            conexiones: [C('d', 'default', 'p'), C('p', 'default', 'm'), C('m', 'default', 'e'), C('e', 'default', 'w'), C('w', 'default', 's')],
        },
    },
    {
        id: 'cita', nombre: 'Reserva o cita', familias: ['servicios', 'salud', 'educacion', 'inmobiliaria'],
        descripcion: 'Toma nombre y fecha deseada, deja al cliente marcado con "cita_pendiente" y avisa a una persona para confirmar.',
        definicion: {
            nodos: [
                N('d', 'disparador', 0, 0, { modo: 'palabra', palabra: 'cita' }),
                N('p1', 'pregunta', 1, 0, { texto: '¡Con gusto! ¿A nombre de quién agendamos?', campo: 'nombre_completo' }),
                N('p2', 'pregunta', 2, 0, { texto: '¿Qué día y a qué hora te queda mejor?', campo: 'fecha' }),
                N('e', 'etiqueta', 3, 0, { accion: 'poner', nombre: 'cita_pendiente' }),
                N('m', 'mensaje', 4, 0, { texto: 'Listo, {nombre_completo}. Recibimos tu solicitud para: {fecha}.' }),
                N('a', 'asesor', 5, 0, { aviso: 'Una persona del equipo confirma tu cita en breve. 🙌' }),
            ],
            conexiones: [C('d', 'default', 'p1'), C('p1', 'default', 'p2'), C('p2', 'default', 'e'), C('e', 'default', 'm'), C('m', 'default', 'a')],
        },
    },
    {
        id: 'pago', nombre: 'Cobro con métodos de pago', familias: [],
        descripcion: 'Quien escribe "pagar" recibe tus métodos de pago (Nequi / Bancolombia de Ajustes) y queda marcado como "esperando_pago".',
        definicion: {
            nodos: [
                N('d', 'disparador', 0, 0, { modo: 'palabra', palabra: 'pagar' }),
                N('m', 'mensaje', 1, 0, { texto: '¡Perfecto, {nombre}! Estas son las formas de pago:' }),
                N('i', 'info_pago', 2, 0, { nota: 'Cuando pagues, envíame la captura del comprobante por este chat y lo verifico. ✅' }),
                N('e', 'etiqueta', 3, 0, { accion: 'poner', nombre: 'esperando_pago' }),
            ],
            conexiones: [C('d', 'default', 'm'), C('m', 'default', 'i'), C('i', 'default', 'e')],
        },
    },
    {
        id: 'gracias', nombre: 'Gracias por tu compra', familias: [],
        descripcion: 'Arranca solo cuando se confirma el pago de un pedido: agradece, marca al cliente como "cliente" y le recuerda cómo escribirte.',
        definicion: {
            nodos: [
                N('d', 'disparador', 0, 0, { modo: 'pedido_pagado' }),
                N('m', 'mensaje', 1, 0, { texto: '¡Gracias por tu compra, {nombre}! 🙌 Tu pago fue confirmado y ya estamos con tu pedido.' }),
                N('e', 'etiqueta', 2, 0, { accion: 'poner', nombre: 'cliente' }),
                N('m2', 'mensaje', 3, 0, { texto: 'Si necesitas algo más, escríbenos por aquí cuando quieras. 💛' }),
            ],
            conexiones: [C('d', 'default', 'm'), C('m', 'default', 'e'), C('e', 'default', 'm2')],
        },
    },
    {
        id: 'reactivacion', nombre: 'Recuperar clientes inactivos', familias: ['restaurante', 'retail', 'servicios'],
        descripcion: 'Si un cliente lleva 30 días sin comprar le escribe con opciones para volver (solo a quien aceptó marketing).',
        definicion: {
            nodos: [
                N('d', 'disparador', 0, 0, { modo: 'cliente_inactivo', dias: 30 }),
                N('m', 'mensaje', 1, 0, { texto: 'Hola {nombre} 💛 ¡Te extrañamos! Hace un tiempo no nos visitas y queremos que vuelvas.' }),
                N('o', 'opciones', 2, 0, { texto: '¿Qué te gustaría hacer?', o1: 'Hacer un pedido', o2: 'Ver las promociones', o3: 'Ahora no, gracias' }),
                N('p', 'pedido', 3, 0, { cobrar: true, cupon: true }),
                N('i', 'ia', 3, 1, { instruccion: 'Cuenta las promociones y novedades del negocio y pregunta qué le gustaría pedir.' }),
                N('e', 'etiqueta', 3, 2, { accion: 'poner', nombre: 'no_interesado' }),
                N('g', 'mensaje', 4, 2, { texto: 'Gracias por contestar, {nombre}. Aquí estamos cuando quieras. 🙌' }),
            ],
            conexiones: [C('d', 'default', 'm'), C('m', 'default', 'o'), C('o', '1', 'p'), C('o', '2', 'i'), C('o', '3', 'e'), C('e', 'default', 'g')],
        },
    },
];

/** Plantillas para mostrar: las que se recomiendan para la familia del negocio primero. */
function listarPlantillas(familia = null) {
    const recomendada = (p) => p.familias.length === 0 || (familia && p.familias.includes(familia));
    return [...PLANTILLAS]
        .map((p) => ({ ...p, recomendada: recomendada(p) }))
        .sort((a, b) => Number(b.recomendada) - Number(a.recomendada));
}

module.exports = { PLANTILLAS, listarPlantillas };
