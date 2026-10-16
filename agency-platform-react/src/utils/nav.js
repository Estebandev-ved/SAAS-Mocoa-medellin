import {
  LayoutDashboard, MessageSquare, ShoppingCart, Package, Activity, Users, Zap, Settings,
  TrendingUp, CreditCard, Truck, Phone, UtensilsCrossed, Store, BookOpen, Tag, Send, Smartphone,
} from 'lucide-react'

// Fuente única de las pantallas del dueño: la usan el menú inferior móvil y la paleta de
// comandos (Ctrl/Cmd+K). El menú lateral del Dashboard conserva su propia lista porque
// además maneja bloqueos por plan.
export const PANTALLAS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', palabras: 'inicio resumen' },
  { icon: ShoppingCart, label: 'Pedidos', path: '/pedidos', palabras: 'ventas comprobantes pagos' },
  { icon: MessageSquare, label: 'Conversaciones', path: '/conversaciones', palabras: 'chats mensajes clientes' },
  { icon: Package, label: 'Productos', path: '/productos', palabras: 'catalogo inventario stock' },
  { icon: Users, label: 'Clientes', path: '/clientes', palabras: 'contactos' },
  { icon: Smartphone, label: 'WhatsApp', path: '/whatsapp', palabras: 'conectar qr bot' },
  { icon: Zap, label: 'Automatizaciones', path: '/automatizaciones', palabras: 'bot agentes probar' },
  { icon: Send, label: 'Campañas', path: '/campanas', palabras: 'masivos difusion' },
  { icon: Tag, label: 'Cupones', path: '/cupones', palabras: 'descuentos' },
  { icon: Truck, label: 'Domicilios', path: '/domicilios', palabras: 'entregas repartidores' },
  { icon: UtensilsCrossed, label: 'Restaurantes', path: '/restaurantes', palabras: 'sedes' },
  { icon: Store, label: 'Caja', path: '/caja', palabras: 'efectivo' },
  { icon: Activity, label: 'Monitoreo', path: '/monitoreo', palabras: 'estado salud' },
  { icon: TrendingUp, label: 'Analytics', path: '/analytics', palabras: 'estadisticas graficas' },
  { icon: MessageSquare, label: 'Multi-Canal', path: '/multichannel', palabras: 'instagram telegram' },
  { icon: Phone, label: 'Bot Llamadas', path: '/voice', palabras: 'voz telefono' },
  { icon: CreditCard, label: 'Suscripción', path: '/suscripcion', palabras: 'plan pagar renovar factura' },
  { icon: BookOpen, label: 'Guía de uso', path: '/guia', palabras: 'ayuda tutorial' },
  { icon: Settings, label: 'Ajustes', path: '/ajustes', palabras: 'configuracion notificaciones tema oscuro' },
]

export const RUTAS_DUENO = PANTALLAS.map((p) => p.path)

export const esRutaDueno = (pathname) => RUTAS_DUENO.includes(pathname.replace(/\/+$/, '') || '/')
