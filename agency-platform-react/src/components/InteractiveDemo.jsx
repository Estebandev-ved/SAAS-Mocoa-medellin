import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle2, Search, Clock, Bot, User, DollarSign } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
import socket, { subscribeToBusiness } from '../services/socket';
import { ordersService, api } from '../services/api';

const InteractiveDemo = () => {
  const { branding } = useBranding();
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: `¡Hola! 👋 Soy el asistente de ${branding.name}. Pruébame escribiendo "hola", "precios" o haciendo un pedido ficticio.` }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ revenue: 0, orders: 0, pending: 0 });
  const [isConnected, setIsConnected] = useState(false);
  
  const scrollRef = useRef(null);

  useEffect(() => {
    // Connect and subscribe to business #1 (dev)
    subscribeToBusiness(1);
    setIsConnected(true);

    // Initial fetch
    const fetchInitialData = async () => {
      try {
        const ordersData = await ordersService.getAll();
        setOrders(ordersData.data.slice(0, 5));
        
        // Calculate stats from orders for the demo
        const total = ordersData.data.reduce((acc, o) => acc + parseFloat(o.total), 0);
        const pending = ordersData.data.filter(o => o.status === 'pendiente_pago' || o.status === 'pago_enviado').length;
        setStats({
          revenue: total,
          orders: ordersData.data.length,
          pending: pending
        });
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    fetchInitialData();

    // Listen for real-time orders
    socket.on('nuevo_pedido', (pedido) => {
      setOrders(prev => [pedido, ...prev.slice(0, 4)]);
      setStats(prev => ({
        ...prev,
        revenue: prev.revenue + parseFloat(pedido.total),
        orders: prev.orders + 1,
        pending: prev.pending + 1
      }));
      
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        type: 'detect', 
        text: `🚀 ¡NUEVO PEDIDO EN VIVO! — ${pedido.cliente_nombre} — $${parseFloat(pedido.total).toLocaleString('es-CO')}` 
      }]);
    });

    socket.on('estado_cambiado', ({ pedidoId, nuevoEstado, pedidoActualizado }) => {
      setOrders(prev => prev.map(o => o.id === pedidoId ? { ...o, estado: nuevoEstado } : o));
      if (nuevoEstado === 'pago_confirmado') {
        setStats(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1) }));
      }
    });

    return () => {
      socket.off('nuevo_pedido');
      socket.off('estado_cambiado');
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    const userMsg = { id: Date.now(), type: 'user', text: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    
    try {
      // Call backend Chat API
      const response = await api.post('/chat/mensaje', {
        mensaje: inputValue,
        contexto: messages.slice(-5).map(m => ({ 
          rol: m.type === 'user' ? 'cliente' : 'bot', 
          contenido: m.text 
        }))
      });

      const { data } = response.data;
      
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        type: 'bot', 
        text: data.respuesta 
      }]);

      if (data.intencion === 'pedido' && data.datos_pedido) {
        setMessages(prev => [...prev, { 
          id: Date.now() + 2, 
          type: 'detect', 
          text: `🔍 IA detectó intención de pedido — Procesa automático...` 
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        type: 'bot', 
        text: 'Lo siento, perdí conexión con mi cerebro artificial. 🧠❌ Por favor verifica que el backend esté corriendo.' 
      }]);
    }
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
          <div className="bg-bg3 border border-border rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="bg-bg2/80 backdrop-blur-md p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent-dim border border-border flex items-center justify-center text-accent">
                  <Bot size={20} />
                </div>
                <div>
                  <div className="font-bold text-sm">Bot Activo — {branding.name}</div>
                  <div className="text-[11px] text-muted flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent pulse-glow" /> Respondiendo pedidos
                  </div>
                </div>
              </div>
              <div className="bg-bg3 px-3 py-1 rounded-full border border-border text-[10px] font-mono text-accent">LIVE</div>
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
                className="bg-accent text-bg p-3 rounded-xl cursor-pointer border-none shadow-[0_0_15px_rgba(0,255,209,0.2)]"
              >
                <Send size={20} />
              </motion.button>
            </div>
          </div>

          {/* Orders Panel */}
          <div className="bg-bg3 border border-border rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="bg-bg2/80 backdrop-blur-md p-5 border-b border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-dim flex items-center justify-center text-accent">
                <Search size={18} />
              </div>
              <span className="font-mono text-[11px] font-bold tracking-[0.1em] uppercase">Panel de Pedidos en Vivo</span>
            </div>

            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              <div className="p-6 text-center">
                <div className="text-xl font-mono font-bold text-accent">${Math.round(stats.revenue/1000)}K</div>
                <div className="text-[10px] text-muted font-mono uppercase mt-1">Ventas Hoy</div>
              </div>
              <div className="p-6 text-center">
                <div className="text-xl font-mono font-bold text-accent">{stats.orders}</div>
                <div className="text-[10px] text-muted font-mono uppercase mt-1">Pedidos</div>
              </div>
              <div className="p-6 text-center">
                <div className="text-xl font-mono font-bold text-accent">{stats.pending}</div>
                <div className="text-[10px] text-muted font-mono uppercase mt-1">Pendientes</div>
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
                        <div className="text-[11px] text-muted">
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
                      <div className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
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
