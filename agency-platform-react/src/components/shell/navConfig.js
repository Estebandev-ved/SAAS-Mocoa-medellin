import {
  LayoutDashboard, MessageSquare, ShoppingCart, Package, Activity, Users, Zap, Settings, TrendingUp,
  CreditCard, Truck, Smartphone, Phone, UtensilsCrossed, Store, BookOpen, Tag, Send, Layers, Shield, ChefHat, Workflow,
  Megaphone, BarChart3, Share2,
} from 'lucide-react';

// Fuente única de la navegación del panel del dueño: la usan el menú lateral, la barra inferior,
// el cajón "Más", las pestañas de cada sección y la paleta de comandos (Ctrl+K).
//
// El menú tiene 8 entradas por TAREA del dueño (ver docs/organizacion-de-la-app.md):
//   Inicio · Mensajes · Ventas · Productos · Clientes · Marketing · Reportes · Ajustes
// Cada entrada es una SECCIÓN; sus `items` son las pestañas que se ven arriba al entrar (si hay más de una).
// Las rutas de cada pantalla no cambian. Propiedades de un item:
//   corto        nombre abreviado para la barra inferior del celular
//   incluye      otras rutas que cuentan como "esta pestaña" (p. ej. Canales agrupa WhatsApp, Instagram y Llamadas)
//   soloBuscador aparece solo en Ctrl+K, no como pestaña
//   lock         bloqueo por plan ('domicilios' | 'caja')
export const GRUPOS = [
  {
    id: 'inicio', label: 'Inicio', icon: LayoutDashboard,
    items: [{ icon: LayoutDashboard, label: 'Inicio', path: '/dashboard' }],
  },
  {
    id: 'mensajes', label: 'Mensajes', icon: MessageSquare,
    items: [{ icon: MessageSquare, label: 'Mensajes', path: '/conversaciones' }],
  },
  {
    id: 'ventas', label: 'Ventas', icon: ShoppingCart,
    items: [
      { icon: ShoppingCart, label: 'Pedidos', path: '/pedidos', badge: 'pedidos' },
      { icon: Truck, label: 'Domicilios', path: '/domicilios', lock: 'domicilios' },
      { icon: Store, label: 'Caja', path: '/caja', lock: 'caja' },
    ],
  },
  {
    id: 'productos', label: 'Productos', icon: Package,
    items: [
      { icon: Package, label: 'Productos e inventario', corto: 'Productos', path: '/productos' },
      { icon: UtensilsCrossed, label: 'Restaurantes', path: '/restaurantes', lock: 'domicilios' },
    ],
  },
  {
    id: 'clientes', label: 'Clientes', icon: Users,
    items: [{ icon: Users, label: 'Clientes', path: '/clientes' }],
  },
  {
    id: 'marketing', label: 'Marketing', icon: Megaphone,
    items: [
      { icon: Workflow, label: 'Respuestas automáticas', path: '/flujos' },
      { icon: Send, label: 'Campañas', path: '/campanas' },
      { icon: Tag, label: 'Cupones', path: '/cupones' },
      { icon: Zap, label: 'Automatizaciones', path: '/automatizaciones' },
    ],
  },
  {
    id: 'reportes', label: 'Reportes', icon: BarChart3,
    items: [
      { icon: TrendingUp, label: 'Estadísticas', path: '/analytics' },
      { icon: Activity, label: 'Rendimiento del bot', path: '/monitoreo' },
    ],
  },
  {
    id: 'ajustes', label: 'Ajustes', icon: Settings,
    items: [
      { icon: Settings, label: 'Mi negocio', path: '/ajustes' },
      { icon: Share2, label: 'Canales', path: '/canales', incluye: ['/whatsapp', '/multichannel', '/voice'] },
      { icon: CreditCard, label: 'Mi plan', path: '/suscripcion' },
      { icon: BookOpen, label: 'Guía de uso', path: '/guia' },
      // Solo para encontrarlas con Ctrl+K: dentro de la app se llega desde Canales
      { icon: Smartphone, label: 'WhatsApp', path: '/whatsapp', soloBuscador: true },
      { icon: Layers, label: 'Instagram y otros canales', path: '/multichannel', soloBuscador: true },
      { icon: Phone, label: 'Llamadas', path: '/voice', soloBuscador: true },
    ],
  },
];

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

/** Los grupos con las herramientas que aplican a este negocio (hoy: modo cocina en restaurantes). */
export function gruposParaNegocio({ conCocina = false } = {}) {
  return conCocina ? insertarDespuesDe(GRUPOS, 'ventas', '/pedidos', ITEM_COCINA) : GRUPOS;
}

const coincide = (item, pathname) => pathname === item.path || (item.incluye || []).includes(pathname);

/** Pestañas de una sección (sin las que son solo para el buscador). */
export const pestanasDe = (grupo) => grupo.items.filter((i) => !i.soloBuscador);

/** La sección a la que pertenece una ruta, o undefined (p. ej. /bienvenida, /admin). */
export function seccionDe(grupos, pathname) {
  return grupos.find((g) => g.items.some((i) => coincide(i, pathname)));
}

/** ¿Esta pestaña es la de la ruta actual? */
export const pestanaActiva = (item, pathname) => coincide(item, pathname);

/** A dónde lleva la entrada del menú: a la primera pestaña que el plan permite. */
export function rutaDeSeccion(grupo, plan) {
  const tabs = pestanasDe(grupo);
  return (tabs.find((t) => !estaBloqueado(t, plan)) || tabs[0]).path;
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
