// Hitos que el equipo de personajes celebra la primera vez que ocurren.
// Cada hito se muestra una sola vez por cuenta (ver HitosContext).
// personaje: 'nova' (guía) | 'sofia' (ventas) | 'mateo' (domicilios) | 'lucia' (atención)
export const HITOS = {
  producto: {
    personaje: 'sofia',
    titulo: '¡Sumaste tu primer producto!',
    mensaje: 'Tu bot ya sabe qué vender. Sigue armando tu catálogo y conecta tu WhatsApp para que empiece a atender.',
    accion: { label: 'Conectar WhatsApp', to: '/whatsapp' },
  },
  whatsapp: {
    personaje: 'nova',
    titulo: '¡Tu bot está en línea!',
    mensaje: 'WhatsApp quedó conectado. Tu prueba gratis de 7 días arrancó con esta primera conexión.',
    accion: { label: 'Ver conversaciones', to: '/conversaciones' },
  },
  pedido: {
    personaje: 'sofia',
    titulo: '¡Llegó tu primer pedido!',
    mensaje: 'Tu bot cerró su primera venta. Revísalo, confírmalo y mira cómo se ve en tu tablero.',
    accion: null,
  },
  venta_cobrada: {
    personaje: 'sofia',
    titulo: '¡Primera venta cobrada!',
    mensaje: 'Un cliente ya pagó y tú lo confirmaste. Así se ve el dinero entrando de verdad.',
    accion: null,
  },
  domicilio: {
    personaje: 'mateo',
    titulo: '¡Primer domicilio entregado!',
    mensaje: 'Tu primer pedido ya llegó a la puerta del cliente. Mateo lo tiene bajo control.',
    accion: { label: 'Ver domicilios', to: '/domicilios' },
  },
  cien_mensajes: {
    personaje: 'lucia',
    titulo: '¡100 mensajes atendidos!',
    mensaje: 'Tu bot ya lleva 100 conversaciones respondidas. Cada vez atiende más rápido y mejor.',
    accion: null,
  },
};
