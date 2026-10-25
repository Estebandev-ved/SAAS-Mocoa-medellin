import {
  LayoutDashboard, MessageSquare, ShoppingCart, Package, Activity, Users, Zap, Settings, TrendingUp,
  CreditCard, Truck, Smartphone, Phone, UtensilsCrossed, Store, BookOpen, Tag, Send, Layers, Shield, ChefHat, Workflow,
} from 'lucide-react';

// Fuente única de la navegación del panel del dueño: la usan el menú lateral, la barra inferior,
// el cajón "Más" y la paleta de comandos (Ctrl+K). Para agregar una pantalla, se agrega aquí.
//
// Organizado por TAREA del dueño (ver docs/organizacion-de-la-app.md), no por tecnología:
//   Inicio · Mensajes · Ventas · Productos · Clientes · Marketing · Reportes · Ajustes
// Un grupo con un solo elemento se muestra como enlace directo, sin encabezado. Las rutas no cambian.
export const GRUPOS = [
  {
    id: 'inicio',
    label: 'Inicio',
    items: [
      { icon: LayoutDashboard, label: 'Inicio', path: '/dashboard' },
    ],
  },
  {
    id: 'mensajes',
    label: 'Mensajes',
    items: [
      { icon: MessageSquare, label: 'Mensajes', path: '/conversaciones' },
    ],
  },
  {
    id: 'ventas',
    label: 'Ventas',
    items: [
      { icon: ShoppingCart, label: 'Pedidos', path: '/pedidos', badge: 'pedidos' },
      { icon: Truck, label: 'Domicilios', path: '/domicilios', lock: 'domicilios' },
      { icon: Store, label: 'Caja', path: '/caja', lock: 'caja' },
    ],
  },
  {
    id: 'productos',
    label: 'Productos',
    items: [
      { icon: Package, label: 'Productos e inventario', corto: 'Productos', path: '/productos' },
      { icon: UtensilsCrossed, label: 'Restaurantes', path: '/restaurantes', lock: 'domicilios' },
    ],
  },
  {
    id: 'clientes',
    label: 'Clientes',
    items: [
      { icon: Users, label: 'Clientes', path: '/clientes' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      { icon: Workflow, label: 'Respuestas automáticas', path: '/flujos' },
      { icon: Send, label: 'Campañas', path: '/campanas' },
      { icon: Tag, label: 'Cupones', path: '/cupones' },
      { icon: Zap, label: 'Automatizaciones', path: '/automatizaciones' },
    ],
  },
  {
    id: 'reportes',
    label: 'Reportes',
    items: [
      { icon: TrendingUp, label: 'Estadísticas', path: '/analytics' },
      { icon: Activity, label: 'Rendimiento del bot', path: '/monitoreo' },
    ],
  },
  {
    id: 'ajustes',
    label: 'Ajustes',
    items: [
      { icon: Settings, label: 'Ajustes del negocio', path: '/ajustes' },
      { icon: Smartphone, label: 'WhatsApp', path: '/whatsapp' },
      { icon: Layers, label: 'Otros canales', path: '/multichannel' },
      { icon: Phone, label: 'Llamadas', path: '/voice' },
      { icon: CreditCard, label: 'Mi plan', path: '/suscripcion' },
      { icon: BookOpen, label: 'Guía de uso', path: '/guia' },
    ],
  },
];

// `corto`: nombre abreviado para la barra inferior del celular (no cabe en dos líneas).
// Solo para negocios tipo restaurante (utils/capacidades.js): va justo debajo de Pedidos, en Ventas
export const ITEM_COCINA = { icon: ChefHat, label: 'Modo cocina', path: '/cocina', badge: 'cocina' };

export const ITEM_ADMIN = { icon: Shield, label: 'Panel Admin', path: '/admin' };

// Atajos de la barra inferior en celular (el resto va en el cajón "Más")
export const BARRA_INFERIOR = ['/dashboard', '/conversaciones', '/pedidos', '/productos'];

/** Inserta un elemento en un grupo, justo después del elemento con esa ruta (o al final si no está). */
export function insertarDespuesDe(grupos, grupoId, despuesDePath, item) {
  return grupos.map((g) => {
    if (g.id !== grupoId) return g;
    const i = g.items.findIndex((x) => x.path === despuesDePath);
    const pos = i === -1 ? g.items.length : i + 1;
    return { ...g, items: [...g.items.slice(0, pos), item, ...g.items.slice(pos)] };
  });
}

export function estaBloqueado(item, plan) {
  if (item.lock === 'domicilios') return plan === 'starter' || plan === 'emprendedor';
  if (item.lock === 'caja') return plan !== 'emprendedor';
  return false;
}
export const textoBloqueo = (item) =>
  item.lock === 'caja' ? 'La caja es del plan Emprendedor' : 'Mejora tu plan para acceder a Domicilios';

export const planLabel = (p) =>
  ({ enterprise: 'Empresarial', professional: 'Profesional', emprendedor: 'Emprendedor' }[p] || 'Inicial');
