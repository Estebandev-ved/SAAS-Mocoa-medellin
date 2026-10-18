import { Zap, MessageSquare, Clock, ListChecks, HelpCircle, Tag, GitBranch, Sparkles, ShoppingBag, UserRound } from 'lucide-react';

// Catálogo cerrado de nodos del constructor de flujos (ver docs/constructor-de-flujos.md).
// `salidas` son los puntos de salida del nodo; `config` son los campos editables y sus valores iniciales.
export const TIPOS = {
  disparador: { etiqueta: 'Disparador', icono: Zap, color: '#F59E0B', entrada: false, salidas: ['default'],
    config: { modo: 'palabra', palabra: 'MENU' }, resumen: (c) => (c.modo === 'primer_mensaje' ? 'Primer mensaje del cliente' : `Palabra: "${c.palabra || '…'}"`) },
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
    config: { valor: 'cliente_vip' }, resumen: (c) => `Si tiene etiqueta "${c.valor || '…'}"` },
  ia: { etiqueta: 'Responde la IA', icono: Sparkles, color: '#16A34A', entrada: true, salidas: ['default'],
    config: { instruccion: 'Responde con los productos y precios del negocio.' }, resumen: (c) => c.instruccion },
  pedido: { etiqueta: 'Tomar pedido', icono: ShoppingBag, color: '#CA8A04', entrada: true, salidas: ['default'],
    config: { cobrar: true, cupon: false }, resumen: (c) => `Pedido${c.cobrar ? ' + cobro' : ''}${c.cupon ? ' + cupón' : ''}` },
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
