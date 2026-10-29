import { Zap, MessageSquare, Clock, ListChecks, HelpCircle, Tag, GitBranch, Sparkles, ShoppingBag, UserRound, Wallet, CornerUpRight } from 'lucide-react';

// Cómo empieza un flujo: lo que escribe el cliente, o algo que pasa en el negocio (el flujo arranca solo).
export const MODOS_DISPARADOR = [
  { valor: 'palabra', etiqueta: 'Cuando escriben una palabra' },
  { valor: 'primer_mensaje', etiqueta: 'En el primer mensaje del cliente' },
  { valor: 'pedido_pagado', etiqueta: 'Cuando se confirma el pago de un pedido' },
  { valor: 'pedido_entregado', etiqueta: 'Cuando se entrega un pedido' },
  { valor: 'cliente_inactivo', etiqueta: 'Cuando un cliente lleva días sin comprar' },
  { valor: 'comentario_instagram', etiqueta: 'Cuando comentan una palabra en Instagram' },
];
export const esEvento = (modo) => ['pedido_pagado', 'pedido_entregado', 'cliente_inactivo'].includes(modo);

// Qué se pregunta en una condición (cada una tiene salida Sí y No)
export const TIPOS_CONDICION = [
  { valor: 'etiqueta', etiqueta: 'El cliente tiene una etiqueta' },
  { valor: 'dato', etiqueta: 'Un dato que respondió contiene…' },
  { valor: 'gastado', etiqueta: 'Ha gastado al menos…' },
  { valor: 'pedidos', etiqueta: 'Ha hecho al menos N pedidos' },
  { valor: 'horario', etiqueta: 'Estamos dentro del horario de atención' },
  { valor: 'stock', etiqueta: 'Hay stock de un producto' },
];

// Catálogo cerrado de nodos del constructor de flujos (ver docs/constructor-de-flujos.md).
// `salidas` son los puntos de salida del nodo; `config` son los campos editables y sus valores iniciales.
export const TIPOS = {
  disparador: { etiqueta: 'Disparador', icono: Zap, color: '#F59E0B', entrada: false, salidas: ['default'],
    config: { modo: 'palabra', palabra: 'MENU', dias: 30, respuestas: '' },
    resumen: (c) => {
      if (c.modo === 'primer_mensaje') return 'Primer mensaje del cliente';
      if (c.modo === 'pedido_pagado') return 'Cuando se paga un pedido';
      if (c.modo === 'pedido_entregado') return 'Cuando se entrega un pedido';
      if (c.modo === 'comentario_instagram') return `Comentario en Instagram: "${c.palabra || '…'}"`;
      if (c.modo === 'cliente_inactivo') return `Cliente sin comprar ${c.dias || 30} días`;
      return `Palabra: "${c.palabra || '…'}"`;
    } },
  mensaje: { etiqueta: 'Mensaje', icono: MessageSquare, color: '#2563EB', entrada: true, salidas: ['default'],
    config: { texto: 'Hola {nombre}, ¿en qué te ayudo?' }, resumen: (c) => c.texto },
  espera: { etiqueta: 'Espera', icono: Clock, color: '#64748B', entrada: true, salidas: ['default'],
    config: { cantidad: 10, unidad: 'minutos' }, resumen: (c) => `Esperar ${c.cantidad} ${c.unidad}` },
  opciones: { etiqueta: 'Opciones', icono: ListChecks, color: '#7C3AED', entrada: true, salidas: ['1', '2', '3'],
    config: { texto: '¿Qué quieres hacer?', o1: 'Ver menú', o2: 'Hacer pedido', o3: 'Hablar con alguien' }, resumen: (c) => c.texto },
  pregunta: { etiqueta: 'Pregunta', icono: HelpCircle, color: '#0891B2', entrada: true, salidas: ['default'],
    config: { texto: '¿Cuál es tu barrio?', campo: 'barrio' }, resumen: (c) => `Guarda en "${c.campo || '…'}"` },
  etiqueta: { etiqueta: 'Etiqueta', icono: Tag, color: '#DB2777', entrada: true, salidas: ['default'],
    config: { accion: 'poner', nombre: 'interesado' }, resumen: (c) => `${c.accion === 'quitar' ? 'Quitar' : 'Poner'} "${c.nombre || '…'}"` },
  condicion: { etiqueta: 'Condición', icono: GitBranch, color: '#EA580C', entrada: true, salidas: ['si', 'no'],
    config: { tipo: 'etiqueta', valor: 'cliente_vip', campo: '', minimo: 1, producto_id: 0 },
    resumen: (c) => {
      switch (c.tipo) {
        case 'dato': return `Si "${c.campo || '…'}" contiene "${c.valor || '…'}"`;
        case 'gastado': return `Si ha gastado ≥ $${Number(c.minimo || 0).toLocaleString('es-CO')}`;
        case 'pedidos': return `Si tiene ≥ ${c.minimo || 0} pedidos`;
        case 'horario': return 'Si estamos dentro del horario';
        case 'stock': return c.producto_id ? `Si hay stock del producto #${c.producto_id}` : 'Si hay stock (elige el producto)';
        default: return `Si tiene etiqueta "${c.valor || '…'}"`;
      }
    } },
  ia: { etiqueta: 'Responde la IA', icono: Sparkles, color: '#16A34A', entrada: true, salidas: ['default'],
    config: { instruccion: 'Responde con los productos y precios del negocio.' }, resumen: (c) => c.instruccion },
  pedido: { etiqueta: 'Tomar pedido', icono: ShoppingBag, color: '#CA8A04', entrada: true, salidas: ['default'],
    config: { cobrar: true, cupon: false }, resumen: (c) => `Pedido${c.cobrar ? ' + cobro' : ''}${c.cupon ? ' + cupón' : ''}` },
  info_pago: { etiqueta: 'Métodos de pago', icono: Wallet, color: '#0D9488', entrada: true, salidas: ['default'],
    config: { nota: 'Cuando pagues, envíame la captura del comprobante.' }, resumen: (c) => c.nota || 'Envía tus Nequi / Bancolombia' },
  saltar: { etiqueta: 'Pasar a otro flujo', icono: CornerUpRight, color: '#6D28D9', entrada: true, salidas: [],
    config: { flujo_id: 0 }, resumen: (c) => (c.flujo_id ? `Continúa en el flujo #${c.flujo_id}` : 'Elige el flujo') },
  asesor: { etiqueta: 'Pasar a asesor', icono: UserRound, color: '#475569', entrada: true, salidas: [],
    config: { aviso: 'Te paso con una persona del equipo.' }, resumen: (c) => c.aviso },
};

export const NODO_ANCHO = 220;
export const NODO_ALTO = 84;

export function nuevoNodo(tipo, x, y) {
  return { id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, tipo, x, y, config: { ...TIPOS[tipo].config } };
}

// Flujo de ejemplo para que el lienzo no se vea vacío.
export function flujoEjemplo() {
  const n = (id, tipo, x, y, config) => ({ id, tipo, x, y, config: { ...TIPOS[tipo].config, ...config } });
  return {
    nombre: 'Promo por WhatsApp',
    nodos: [
      n('a', 'disparador', 40, 60, { palabra: 'PROMO' }),
      n('b', 'mensaje', 330, 60, { texto: '¡Hola {nombre}! Hoy tenemos 2x1 en combos.' }),
      n('c', 'opciones', 620, 60, { texto: '¿Te animas?', o1: 'Sí, pedir', o2: 'Ver menú', o3: 'Más tarde' }),
      n('d', 'pedido', 910, 20, {}),
      n('e', 'ia', 910, 140, { instruccion: 'Muestra el menú con precios.' }),
      n('f', 'etiqueta', 910, 260, { nombre: 'recordar_promo' }),
    ],
    conexiones: [
      { desde: 'a', salida: 'default', hacia: 'b' },
      { desde: 'b', salida: 'default', hacia: 'c' },
      { desde: 'c', salida: '1', hacia: 'd' },
      { desde: 'c', salida: '2', hacia: 'e' },
      { desde: 'c', salida: '3', hacia: 'f' },
    ],
  };
}
