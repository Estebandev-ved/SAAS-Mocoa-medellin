import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Search,
  Smartphone,
  Package,
  CreditCard,
  Bot,
  Zap,
  MessageSquare,
  ShoppingCart,
  Users,
  Truck,
  UtensilsCrossed,
  Store,
  TrendingUp,
  Activity,
  Settings,
  Phone,
  Crown,
  Lightbulb,
  Tag,
  Send,
} from 'lucide-react';

// Contenido de la guía. Cada módulo explica: qué es, cómo se usa paso a paso
// y un consejo. Si cambia una pantalla, se edita aquí (un solo lugar).
const PASOS_INICIALES = [
  {
    t: 'Carga tu catálogo',
    d: 'Ve a Productos y agrega lo que vendes con nombre claro, precio real y una descripción corta. El bot solo ofrece y cotiza lo que esté aquí: nunca inventa precios.',
    ir: '/productos',
  },
  {
    t: 'Dile al bot cómo cobrar',
    d: 'En Ajustes → Pago escribe tu número de Nequi y/o Bancolombia. Se los muestra al cliente cuando confirma su pedido.',
    ir: '/ajustes',
  },
  {
    t: 'Conecta tu WhatsApp',
    d: 'En WhatsApp pulsa conectar, abre WhatsApp en tu celular → Dispositivos vinculados → Vincular dispositivo y escanea el código QR. Cuando diga “Conectado”, tu bot ya atiende.',
    ir: '/whatsapp',
  },
  {
    t: 'Personaliza a tu bot',
    d: 'En Automatizaciones ponle nombre, tono (formal, amigable o casual), mensaje de bienvenida y horario. Usa “Probar bot” para chatear con él antes de que atienda clientes reales.',
    ir: '/automatizaciones',
  },
  {
    t: 'Haz una compra de prueba',
    d: 'Escríbele desde otro número como si fueras un cliente: pide un producto, da una dirección y envía una captura de pago. Así ves el recorrido completo.',
    ir: '/pedidos',
  },
];

const MODULOS = [
  {
    id: 'dashboard',
    icon: Activity,
    titulo: 'Dashboard (inicio)',
    resumen: 'El resumen de tu negocio de un vistazo.',
    que: 'Muestra las ventas, pedidos y mensajes de hoy comparados con ayer, el estado de tu bot, tus agentes y automatizaciones, y la lista “Activa tu bot” con los pasos que te faltan.',
    como: [
      'Mira las tarjetas “Hoy” para saber cómo vas en ventas, pedidos y mensajes.',
      'Si ves la lista “Activa tu bot”, complétala de arriba hacia abajo: cada paso hecho se marca solo.',
      'Las tarjetas de Agentes IA y Automatizaciones te dicen qué está encendido; pulsa “Configurar” para cambiarlo.',
    ],
    consejo: 'Entra aquí cada mañana: en 10 segundos sabes si hay pedidos por revisar.',
  },
  {
    id: 'whatsapp',
    icon: Smartphone,
    titulo: 'WhatsApp',
    resumen: 'Aquí conectas tu número al bot.',
    que: 'Vincula tu WhatsApp con el bot escaneando un código QR, igual que WhatsApp Web. Desde ese momento el bot responde a quien te escriba.',
    como: [
      'Pulsa conectar y espera a que aparezca el código QR.',
      'En tu celular: WhatsApp → Dispositivos vinculados → Vincular dispositivo → escanea.',
      'Verás “Conectado”. Si se desconecta, vuelve a entrar y escanea de nuevo.',
    ],
    consejo: 'Usa un número dedicado al negocio y no cierres sesión del dispositivo vinculado desde el celular.',
  },
  {
    id: 'conversaciones',
    icon: MessageSquare,
    titulo: 'Conversaciones',
    resumen: 'Todo lo que tu bot habla con tus clientes.',
    que: 'Lista de chats a la izquierda y el historial completo a la derecha. Se actualiza en tiempo real.',
    como: [
      'Elige una conversación de la lista para leer los mensajes.',
      'Revisa de vez en cuando cómo responde el bot: si ves algo mal, corrige el producto, la política o el tono.',
      'Atención personal: si un cliente escribe “quiero hablar con un asesor” (o califica mal una entrega), el bot se calla, le avisa que una persona lo atenderá y te manda un WhatsApp. Verás la etiqueta “Requiere atención” en la lista.',
      'Escribe tu respuesta en la caja de abajo: llega al WhatsApp del cliente y el bot queda en pausa en ese chat. Cuando termines, pulsa “Retomar bot”. (También puedes pulsar “Atender yo” para tomar un chat cuando quieras.)',
      'Si nadie retoma el chat, el bot vuelve solo a las 12 horas.',
    ],
    consejo: 'Leer 5 conversaciones a la semana es la mejor forma de mejorar tu bot.',
  },
  {
    id: 'pedidos',
    icon: ShoppingCart,
    titulo: 'Pedidos',
    resumen: 'Pedidos y pagos de tu negocio.',
    que: 'Cada compra pasa por estados: pendiente de pago → pago enviado → pago confirmado → en preparación → enviado → entregado (o cancelado).',
    como: [
      'Cuando el cliente manda su comprobante, el bot lo lee y, si el monto coincide, confirma el pago solo.',
      'Si queda en “pago enviado”, ábrelo, mira la imagen y confirma o rechaza tú.',
      'Avanza el pedido a preparación, enviado y entregado conforme lo trabajas.',
    ],
    consejo: 'Marcar “entregado” a tiempo activa la automatización de reseñas (si la tienes encendida).',
  },
  {
    id: 'productos',
    icon: Package,
    titulo: 'Productos',
    resumen: 'Lo que vendes. El bot lo usa para responder.',
    que: 'Tu catálogo con nombre, precio, descripción, categoría y stock. Es la única fuente de precios del bot.',
    como: [
      'Pulsa agregar y llena nombre, precio real y una descripción corta.',
      'Pega el enlace de una foto del producto (campo “Foto (URL)”): cuando el cliente o el bot lo nombren, el bot le envía la foto con el precio (máximo 3 por respuesta).',
      'Mantén el stock al día: la alerta de stock bajo se basa en ese número.',
      'Desactiva un producto cuando se acabe en vez de borrarlo.',
    ],
    consejo: 'Descripciones cortas y concretas (“Hamburguesa doble con papas”) hacen que el bot venda mejor.',
  },
  {
    id: 'clientes',
    icon: Users,
    titulo: 'Clientes',
    resumen: 'Tu base de clientes, creada sola.',
    que: 'Cada persona que le escribe al bot queda registrada con su nombre, correo, historial y si aceptó recibir marketing.',
    como: [
      'El bot les pide nombre, correo y consentimiento la primera vez que escriben.',
      'Consulta aquí el historial de compras de cada cliente.',
    ],
    consejo: 'Solo se contacta por campañas y reenganche a quienes aceptaron marketing (cumple la Ley 1581).',
  },
  {
    id: 'automatizaciones',
    icon: Zap,
    titulo: 'Automatizaciones',
    resumen: 'La personalidad del bot y las tareas que hace solo.',
    que: 'Tiene tres partes: (1) Personalidad: nombre, tono, bienvenida y horario. (2) Agentes IA: las áreas que atiende. (3) Tareas automáticas y campañas masivas.',
    como: [
      'Personalidad: usa “Sugerir” para generar mensajes de bienvenida y de fuera de horario según el tono.',
      'Agentes: enciende solo las áreas que quieres que atienda (Ventas, Pagos, Pedidos, FAQ, Reclamos, Retención). Las apagadas las deriva a una persona.',
      'Recordatorio de pago: avisa al cliente que no ha pagado pasados N minutos.',
      'Pedir reseña: pide opinión cuando el pedido se marca entregado.',
      'Alerta de stock bajo: te avisa por WhatsApp cuando un producto baja del umbral.',
      'Reenganche: escribe a clientes que no compran hace N días (solo con marketing aceptado).',
      'Reporte semanal: te manda por WhatsApp las ventas y pedidos de la semana.',
      'Encuesta de satisfacción: al entregar el pedido pide una nota de 1 a 5. Si es 1 a 3, el bot se pausa en ese chat y te avisa. El promedio aparece abajo.',
      'Recuperar pedidos sin pagar (Professional+): si un pedido sigue sin pagarse pasadas N horas, escribe al cliente y puede ofrecerle un cupón.',
      'Historial: al final de la sección ves lo último que hicieron las automatizaciones (qué mensaje salió y cuándo), para que sepas qué está pasando.',
      'Campañas masivas: tienen su propia sección en el menú (“Campañas”).',
    ],
    consejo: 'Todo arranca apagado: nada le llega a un cliente hasta que tú lo enciendas. Prueba con tu propio número primero.',
  },
  {
    id: 'campanas',
    icon: Send,
    titulo: 'Campañas (marketing)',
    resumen: 'Mensajes masivos a tus clientes.',
    que: 'Envías un mensaje de WhatsApp a un grupo de clientes (todos, inactivos o nuevos) ahora mismo o programado. Solo lo reciben quienes aceptaron marketing. Disponible desde el plan Professional.',
    como: [
      'Pulsa “Usar ejemplo” para partir de un mensaje listo y cámbialo a tu gusto.',
      'Elige a quién enviarlo. Verás cuántos clientes lo recibirán (máximo 200 por campaña).',
      'Déjalo sin fecha para enviarlo ya, o elige una fecha y hora.',
      'Sigue el avance en la lista de abajo y cancélalo si te equivocas.',
    ],
    consejo: 'Incluye un cupón en el mensaje (créalo en Cupones) y mide cuántos lo usan.',
  },
  {
    id: 'cupones',
    icon: Tag,
    titulo: 'Cupones',
    resumen: 'Códigos de descuento que el bot aplica solo.',
    que: 'Creas códigos (por ejemplo VERANO10) de porcentaje o valor fijo, con compra mínima, límite de usos y fecha de vencimiento opcionales.',
    como: [
      'Crea el cupón con su código y valor.',
      'Compártelo en una campaña, en la automatización de recuperación o en tus redes.',
      'El cliente lo escribe al hacer su pedido; el bot lo valida y el pedido sale con el descuento (se muestra en la confirmación).',
      'Puedes desactivarlo en cualquier momento. Un cupón vencido, agotado o por debajo del mínimo no se aplica.',
    ],
    consejo: 'El bot nunca revela ni inventa códigos: solo aplica el que el cliente escribe.',
  },
  {
    id: 'domicilios',
    icon: Truck,
    titulo: 'Domicilios',
    resumen: 'Tus domiciliarios y las entregas.',
    que: 'Registra domiciliarios, asígnales pedidos y deja que el cliente siga su entrega con un enlace. El cliente recibe un código que el domiciliario debe pedirle para marcar entregado.',
    como: [
      'Registra a cada domiciliario (teléfono y PIN para su portal).',
      'Asigna el pedido; el domiciliario lo acepta desde su portal.',
      'Si una entrega se pasa del tiempo límite, se marca como retrasada y luego en disputa para que la revises.',
    ],
    consejo: 'Define bien la tarifa y el tiempo límite: de ellos dependen las alertas de retraso.',
  },
  {
    id: 'restaurantes',
    icon: UtensilsCrossed,
    titulo: 'Restaurantes',
    resumen: 'Varios locales atendidos desde un mismo WhatsApp.',
    que: 'Para empresas de domicilios con varios restaurantes: cada local tiene su carta y dirección de recogida; el bot le pregunta al cliente cuál elige.',
    como: ['Crea cada restaurante con su dirección.', 'Asigna cada producto a su restaurante desde Productos.'],
    consejo: 'Si solo tienes un local, no necesitas esta sección.',
  },
  {
    id: 'caja',
    icon: Store,
    titulo: 'Caja (plan Emprendedor)',
    resumen: 'Inventario, ventas y plata de tu emprendimiento.',
    que: 'Una caja sencilla para llevar tu inventario y tus ventas sin necesitar el bot de WhatsApp.',
    como: ['Carga tu inventario.', 'Registra cada venta apenas ocurra.', 'Revisa el resumen para saber cómo va tu plata.'],
    consejo: 'Registrar al momento, no al final del día, evita descuadres.',
  },
  {
    id: 'analytics',
    icon: TrendingUp,
    titulo: 'Analytics',
    resumen: 'Qué vende más y cuándo.',
    que: 'Compara ventas, pedidos y conversión; muestra días y productos que mejor venden y por qué método te pagan.',
    como: ['Elige el periodo.', 'Fíjate en los días y productos fuertes para decidir qué promocionar.'],
    consejo: 'Programa tus campañas para los días que mejor venden.',
  },
  {
    id: 'multicanal',
    icon: MessageSquare,
    titulo: 'Multi-Canal',
    resumen: 'Telegram e Instagram.',
    que: 'Conecta tu bot a Telegram y a los mensajes directos de Instagram para atender desde un solo lugar.',
    como: ['Sigue los pasos de cada canal (token de Telegram, cuenta de Instagram) y activa el que quieras.'],
    consejo: 'Disponible según tu plan.',
  },
  {
    id: 'voz',
    icon: Phone,
    titulo: 'Bot de Llamadas',
    resumen: 'Atiende llamadas con IA.',
    que: 'Configura la voz, velocidad y personalidad del asistente que contesta llamadas telefónicas.',
    como: ['Elige una voz, ajusta velocidad y temperatura, y guarda.'],
    consejo: 'Función en desarrollo: úsala primero en modo de prueba.',
  },
  {
    id: 'ajustes',
    icon: Settings,
    titulo: 'Ajustes',
    resumen: 'Datos del negocio, bot, pagos y notificaciones.',
    que: 'Pestañas: Negocio, Avatar, Bot, WhatsApp, Pago, Notificaciones y Seguridad. Cada pestaña tiene su propio botón Guardar.',
    como: [
      'Negocio: nombre, descripción, productos/servicios y políticas (el bot las usa para responder).',
      'Bot → modo “Solo números permitidos” (whitelist) sirve para probar: solo responde a los números que pongas.',
      'Pago: Nequi, Bancolombia y datos de facturación.',
      'Notificaciones: avisos por correo, push y WhatsApp.',
    ],
    consejo: 'Mientras pruebas, usa la whitelist con tu número y desactívala el día que salgas al público.',
  },
  {
    id: 'suscripcion',
    icon: CreditCard,
    titulo: 'Suscripción',
    resumen: 'Tu plan, tu uso y tus facturas.',
    que: 'Ves cuánto llevas del ciclo, cambias de plan (subir es inmediato, bajar queda programado para fin del ciclo) y descargas facturas.',
    como: ['Elige el plan y paga con el checkout.', 'Al volver, tu plan queda activo con su factura.'],
    consejo: 'El pago es único por ciclo: te avisamos por WhatsApp y en el panel 3 días y 1 día antes de que venza para que renueves.',
  },
];

const FAQ = [
  ['¿El bot puede inventar precios?', 'No. Solo usa los precios de tu catálogo en Productos.'],
  ['¿Qué pasa si escriben fuera de horario?', 'El bot responde el “mensaje fuera de horario” que configuraste, con la hora de Colombia.'],
  ['¿Cómo confirma el bot un pago?', 'El cliente envía la captura; el bot la lee, compara el monto con el pedido y, si coincide, confirma. Si no, te lo deja para revisión.'],
  ['¿Puedo escribirle yo a un cliente?', 'Sí, desde tu WhatsApp normal. El bot solo responde mensajes que el cliente inicia.'],
  ['¿Me pueden bloquear el número?', 'WhatsApp puede bloquear números que envían mucho a quien no escribió primero. Por eso las campañas tienen tope de 200, pausas entre mensajes y solo van a quienes aceptaron marketing.'],
  ['¿Cómo pruebo sin molestar clientes?', 'Usa Probar bot en Automatizaciones y el modo whitelist en Ajustes → Bot.'],
  ['¿Qué datos guardan de mis clientes?', 'Nombre, correo, teléfono e historial, con su consentimiento. Mira Términos y Privacidad en el pie de página.'],
];

function Acordeon({ abierto, onToggle, children, cabecera, anchor }) {
  return (
    <div id={anchor} className="scroll-mt-6 bg-white border border-border rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={abierto}
        className="w-full flex items-center justify-between gap-3 p-4 bg-transparent border-none cursor-pointer text-left"
      >
        {cabecera}
        <ChevronDown className={`w-5 h-5 text-muted shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && <div className="px-4 pb-5 border-t border-border pt-4">{children}</div>}
    </div>
  );
}

export default function GuiaPage() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  // /guia#cupones abre esa sección directamente (lo usa el botón "¿Cómo funciona?" de cada pantalla)
  const [abierto, setAbierto] = useState(hash ? hash.slice(1) : 'automatizaciones');
  useEffect(() => {
    if (!hash) return;
    setAbierto(hash.slice(1));
    setTimeout(() => document.getElementById(`guia-${hash.slice(1)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [hash]);
  const [q, setQ] = useState('');

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return MODULOS;
    return MODULOS.filter((m) =>
      [m.titulo, m.resumen, m.que, m.consejo, ...m.como].join(' ').toLowerCase().includes(t)
    );
  }, [q]);

  return (
    <div className="min-h-screen bg-bg2 p-6 lg:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            aria-label="Volver al panel"
            className="w-11 h-11 rounded-xl bg-white border border-border flex items-center justify-center cursor-pointer hover:border-[#C9C9C9] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div>
            <h1 className="font-head text-3xl font-bold text-text tracking-tight flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-accent" /> Guía de uso
            </h1>
            <p className="text-muted text-sm mt-1">Todo lo que necesitas para sacarle provecho a tu bot, paso a paso.</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-border rounded-2xl p-6">
          <h2 className="font-head text-xl font-bold text-text mb-1">Empieza aquí: 5 pasos</h2>
          <p className="text-muted text-sm mb-5">En unos 15 minutos tu bot puede estar atendiendo clientes.</p>
          <ol className="space-y-4 list-none p-0 m-0">
            {PASOS_INICIALES.map((p, i) => (
              <li key={p.t} className="flex gap-4">
                <span className="w-8 h-8 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-text font-semibold text-sm">{p.t}</p>
                  <p className="text-muted text-sm leading-5">{p.d}</p>
                  <button
                    onClick={() => navigate(p.ir)}
                    className="mt-1 text-xs font-semibold text-accent bg-transparent border-none p-0 cursor-pointer hover:underline"
                  >
                    Ir ahora →
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </motion.div>

        <div>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-head text-xl font-bold text-text">Cada sección, explicada</h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar (ej: pagos, horario)"
                className="w-full h-11 bg-white border border-[#C9C9C9] rounded-xl pl-9 pr-3 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="space-y-3">
            {filtrados.map((m) => {
              const Icon = m.icon;
              return (
                <Acordeon
                  key={m.id}
                  anchor={`guia-${m.id}`}
                  abierto={abierto === m.id}
                  onToggle={() => setAbierto(abierto === m.id ? null : m.id)}
                  cabecera={
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-xl bg-bg2 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-accent" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-text font-semibold text-sm">{m.titulo}</span>
                        <span className="block text-muted text-xs">{m.resumen}</span>
                      </span>
                    </span>
                  }
                >
                  <p className="text-sm text-text leading-6 mb-3">{m.que}</p>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Cómo se usa</p>
                  <ul className="space-y-2 pl-5 mb-4 list-disc">
                    {m.como.map((c) => (
                      <li key={c} className="text-sm text-text leading-5">
                        {c}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-start gap-2 px-3 py-2 bg-[#FDECEA] border border-accent/20 rounded-xl">
                    <Lightbulb className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <span className="text-xs text-muted">{m.consejo}</span>
                  </div>
                </Acordeon>
              );
            })}
            {filtrados.length === 0 && <p className="text-muted text-sm">No encontramos nada con “{q}”.</p>}
          </div>
        </div>

        <div className="bg-white border border-border rounded-2xl p-6">
          <h2 className="font-head text-xl font-bold text-text mb-4">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {FAQ.map(([p, r]) => (
              <div key={p}>
                <p className="text-text font-semibold text-sm">{p}</p>
                <p className="text-muted text-sm leading-5">{r}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
