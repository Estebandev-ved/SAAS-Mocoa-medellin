import {
  LayoutDashboard, MessageSquare, ShoppingCart, Package, Activity, Users, Zap, Settings, TrendingUp,
  CreditCard, Truck, Smartphone, Phone, UtensilsCrossed, Store, BookOpen, Tag, Send, Layers, Shield,
} from 'lucide-react';

// Fuente única de la navegación del panel del dueño: la usan el menú lateral, la barra inferior,
// el cajón "Más" y la paleta de comandos (Ctrl+K). Para agregar una pantalla, se agrega aquí.
export const GRUPOS = [
  {
    id: 'operacion',
    label: 'Operación',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: ShoppingCart, label: 'Pedidos', path: '/pedidos', badge: 'pedidos' },
      { icon: Truck, label: 'Domicilios', path: '/domicilios', lock: 'domicilios' },
      { icon: Store, label: 'Caja', path: '/caja', lock: 'caja' },
      { icon: Package, label: 'Productos', path: '/productos' },
      { icon: UtensilsCrossed, label: 'Restaurantes', path: '/restaurantes', lock: 'domicilios' },
    ],
  },
  {
    id: 'clientes',
    label: 'Clientes',
    items: [
      { icon: MessageSquare, label: 'Conversaciones', path: '/conversaciones' },
      { icon: Users, label: 'Clientes', path: '/clientes' },
      { icon: Send, label: 'Campañas', path: '/campanas' },
      { icon: Tag, label: 'Cupones', path: '/cupones' },
    ],
  },
  {
    id: 'bot',
    label: 'Tu bot',
    items: [
      { icon: Smartphone, label: 'WhatsApp', path: '/whatsapp' },
      { icon: Zap, label: 'Automatizaciones', path: '/automatizaciones' },
      { icon: Phone, label: 'Bot Llamadas', path: '/voice' },
      { icon: Layers, label: 'Multi-Canal', path: '/multichannel' },
      { icon: Activity, label: 'Monitoreo', path: '/monitoreo' },
      { icon: TrendingUp, label: 'Analytics', path: '/analytics' },
    ],
  },
  {
    id: 'cuenta',
    label: 'Cuenta',
    items: [
      { icon: CreditCard, label: 'Suscripción', path: '/suscripcion' },
      { icon: BookOpen, label: 'Guía de uso', path: '/guia' },
      { icon: Settings, label: 'Ajustes', path: '/ajustes' },
    ],
  },
];

export const ITEM_ADMIN = { icon: Shield, label: 'Panel Admin', path: '/admin' };

// Atajos de la barra inferior en celular (el resto va en el cajón "Más")
export const BARRA_INFERIOR = ['/dashboard', '/pedidos', '/conversaciones', '/domicilios'];

export function estaBloqueado(item, plan) {
  if (item.lock === 'domicilios') return plan === 'starter' || plan === 'emprendedor';
  if (item.lock === 'caja') return plan !== 'emprendedor';
  return false;
}
export const textoBloqueo = (item) =>
  item.lock === 'caja' ? 'La caja es del plan Emprendedor' : 'Mejora tu plan para acceder a Domicilios';

export const planLabel = (p) =>
  ({ enterprise: 'Empresarial', professional: 'Profesional', emprendedor: 'Emprendedor' }[p] || 'Inicial');
