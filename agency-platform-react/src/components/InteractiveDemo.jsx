import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Search, Bot } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

// Demo 100% local: el chat y los pedidos se simulan en el navegador.
// No llama al backend ni a sockets, así que no expone datos de nadie ni puede fallar con 401.
const CATALOGO = [
  { nombre: 'Pan de bono', precio: 2500, palabras: ['pan de bono', 'bono'] },
  { nombre: 'Croissant', precio: 4500, palabras: ['croissant', 'cruasan'] },
  { nombre: 'Torta de chocolate', precio: 18000, palabras: ['torta', 'chocolate'] },
  { nombre: 'Café americano', precio: 3500, palabras: ['cafe', 'café'] },
];

const PEDIDOS_INICIALES = [
  { id: 1, cliente_nombre: 'María G.', detail: 'Torta de chocolate', total: 18000, estado: 'entregado' },
  { id: 2, cliente_nombre: 'Carlos R.', detail: 'Pan de bono +1', total: 11000, estado: 'pago_confirmado' },
];

const fmt = (n) => `$${n.toLocaleString('es-CO')}`;

const responder = (texto) => {
  const t = texto.toLowerCase();
  const items = CATALOGO.filter((p) => p.palabras.some((w) => t.includes(w)));
  if (items.length > 0 && /(quiero|pido|pedir|dame|necesito|me das|quisiera)/.test(t)) {
    const total = items.reduce((a, p) => a + p.precio, 0);
    return {
      respuesta: `¡Listo! Anoté: ${items.map((p) => p.nombre).join(', ')}. Total ${fmt(total)}. Para confirmar, envíame el comprobante de pago por Nequi o transferencia. 🧾`,
      pedido: { detail: items.map((p) => p.nombre).join(', '), total },
    };
  }
  if (/(precio|cuesta|valor|menu|menú|carta|catalogo|catálogo)/.test(t)) {
    return { respuesta: `Esto tenemos hoy:\n${CATALOGO.map((p) => `• ${p.nombre} — ${fmt(p.precio)}`).join('\n')}\n¿Qué te provoca?` };
  }
  if (/(horario|abierto|abren|cierran|hora)/.test(t)) {
    return { respuesta: 'Atendemos todos los días de 7:00 a. m. a 8:00 p. m. Fuera de horario te dejo el pedido listo para la mañana. 🕖' };
  }
  if (/(hola|buenas|buenos|hey|saludos)/.test(t)) {
    return { respuesta: '¡Hola! 👋 Puedo mostrarte el menú, los precios o tomarte un pedido. Prueba con "precios" o "quiero un croissant".' };
  }
  return { respuesta: 'Puedo ayudarte con el menú, precios, horario o tomar tu pedido. Prueba con "precios" o "quiero una torta de chocolate". 🙂' };
};

const InteractiveDemo = () => {
  const { branding } = useBranding();
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: `¡Hola! 👋 Soy el asistente de ${branding.name}. Esta es una demo con datos de ejemplo: escribe "hola", "precios" o haz un pedido ficticio.` }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [orders, setOrders] = useState(PEDIDOS_INICIALES);
  const [stats, setStats] = useState({ revenue: 29000, orders: 2, pending: 0 });

  const scrollRef = useRef(null);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    const texto = inputValue.trim();
    if (!texto || isTyping) return;

    setMessages((prev) => [...prev, { id: Date.now(), type: 'user', text: texto }]);
    setInputValue('');
    setIsTyping(true);

    timers.current.push(setTimeout(() => {
      const { respuesta, pedido } = responder(texto);
      setIsTyping(false);
      setMessages((prev) => [...prev, { id: Date.now() + 1, type: 'bot', text: respuesta }]);

      if (pedido) {
        setMessages((prev) => [...prev, { id: Date.now() + 2, type: 'detect', text: '🔍 IA detectó un pedido — lo registra automático en el panel' }]);
        const nuevo = { id: Date.now() + 3, cliente_nombre: 'Tú (demo)', detail: pedido.detail, total: pedido.total, estado: 'pendiente_pago' };
        setOrders((prev) => [nuevo, ...prev.slice(0, 4)]);
        setStats((prev) => ({ revenue: prev.revenue + pedido.total, orders: prev.orders + 1, pending: prev.pending + 1 }));
      }
    }, 800));
  };

  return (
    <section id="interactive" className="py-24 px-6 bg-bg2/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="section-label">DEMO INTERACTIVA</div>
          <h2 className="section-title">Pruébalo tú mismo,<br /><span className="text-accent">ahora mismo</span></h2>
          <p className="section-sub mx-auto">Escríbele al bot como si fueras un cliente. Mira cómo detecta el pedido automáticamente.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          {/* Chat Window */}
          <div className="bg-bg3 border border-border rounded-3xl overflow-hidden flex flex-col">
            <div className="bg-bg2/80 backdrop-blur-md p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent-dim border border-border flex items-center justify-center text-accent">
                  <Bot size={20} />
                </div>
                <div>
                  <div className="font-bold text-sm">Bot Activo — {branding.name}</div>
                  <div className="text-xs text-muted flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent pulse-glow" /> Respondiendo pedidos
                  </div>
                </div>
              </div>
              <div className="bg-bg3 px-3 py-1 rounded-full border border-border text-xs font-mono text-accent">LIVE</div>
            </div>

            <div ref={scrollRef} className="h-[400px] overflow-y-auto p-6 flex flex-col gap-4">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={`max-w-[85%] p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                      msg.type === 'user' 
                        ? 'bg-bg2 border border-border self-start' 
                        : msg.type === 'detect'
                        ? 'bg-accent-dim border border-accent/20 text-accent font-mono self-center w-full text-center py-3'
                        : 'bg-accent/10 border border-border self-end text-text'
                    }`}
                  >
                    {msg.text.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-accent-dim border border-border p-4 rounded-2xl self-end"
                  >
                    <div className="flex gap-1.5">
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-accent" />
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-accent" />
                      <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-accent" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-5 border-t border-border bg-bg2/30 flex gap-3">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-bg2 border border-border text-text px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-accent transition-colors"
              />
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSend}
                className="bg-accent text-bg p-3 rounded-xl cursor-pointer border-none"
              >
                <Send size={20} />
              </motion.button>
            </div>
          </div>

          {/* Orders Panel */}
          <div className="bg-bg3 border border-border rounded-3xl overflow-hidden flex flex-col">
            <div className="bg-bg2/80 backdrop-blur-md p-5 border-b border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-dim flex items-center justify-center text-accent">
                <Search size={18} />
              </div>
              <span className="text-xs font-bold tracking-[0.04em] uppercase">Panel de Pedidos en Vivo</span>
            </div>

            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              <div className="p-6 text-center">
                <div className="text-xl font-mono font-bold text-accent">${Math.round(stats.revenue/1000)}K</div>
                <div className="text-xs text-muted font-mono uppercase mt-1">Ventas Hoy</div>
              </div>
              <div className="p-6 text-center">
                <div className="text-xl font-mono font-bold text-accent">{stats.orders}</div>
                <div className="text-xs text-muted font-mono uppercase mt-1">Pedidos</div>
              </div>
              <div className="p-6 text-center">
                <div className="text-xl font-mono font-bold text-accent">{stats.pending}</div>
                <div className="text-xs text-muted font-mono uppercase mt-1">Pendientes</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <AnimatePresence initial={false}>
                {orders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-5 border-b border-border hover:bg-glass transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${
                        order.estado === 'entregado' ? 'bg-accent' : 
                        order.estado === 'cancelado' ? 'bg-red-500' : 
                        'bg-warn pulse-glow'
                      }`} />
                      <div>
                        <div className="font-bold text-sm group-hover:text-accent transition-colors">
                          {order.cliente_nombre || `#${order.numero_pedido}`}
                        </div>
                        <div className="text-xs text-muted">
                          {order.items?.length > 0 
                            ? `${order.items[0].producto_nombre}${order.items.length > 1 ? ` +${order.items.length-1}` : ''}`
                            : order.detail || 'Pedido sin items'}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="font-mono text-sm font-bold text-accent">
                        ${parseFloat(order.total).toLocaleString('es-CO')}
                      </div>
                      <div className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                        order.estado === 'entregado' 
                          ? 'border-accent/30 text-accent bg-accent/5' 
                          : order.estado === 'cancelado'
                          ? 'border-red-500/30 text-red-500 bg-red-500/5'
                          : 'border-warn/30 text-warn bg-warn/5'
                      }`}>
                        {(order.estado || 'pendiente').toUpperCase().replace('_', ' ')}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InteractiveDemo;
