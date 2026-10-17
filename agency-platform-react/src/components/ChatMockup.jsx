import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCheck, Phone, Video, Send } from 'lucide-react';
import { Character } from './Illustration';

// Conversación de ejemplo (datos 100% locales, igual que InteractiveDemo): el cliente pide, el bot toma el
// pedido y verifica el comprobante. Se "escribe" sola para explicar el producto en tres segundos.
const GUION = [
  { de: 'cliente', texto: 'Hola, ¿tienen bandeja paisa para hoy?', hora: '12:04' },
  { de: 'bot', texto: '¡Hola! Sí 😊 La bandeja paisa está en $28.000. ¿Cuántas te anoto?', hora: '12:04' },
  { de: 'cliente', texto: '2, y las llevan a la Cra 45 #12-30', hora: '12:05' },
  { de: 'bot', texto: 'Listo ✅ Total $56.000 + domicilio $4.000. Paga por Nequi al 300 123 4567 y envíame el comprobante.', hora: '12:05' },
  { de: 'cliente', texto: '📎 comprobante.jpg', hora: '12:07' },
  { de: 'bot', texto: 'Pago verificado 🎉 Tu pedido #128 ya está en preparación.', hora: '12:07', ok: true },
];

// Respuestas de la demo (100% locales, sin backend: la landing es pública y un bot real sería un
// blanco de abuso). Orienta al visitante a registrarse para probar el bot de verdad con su catálogo.
const RESPUESTAS = [
  { claves: ['horario', 'hora', 'abren', 'cierran', 'abierto'], texto: 'Atendemos todos los días de 11:00 a 21:00 🕚 ¿Te anoto un pedido?' },
  { claves: ['domicilio', 'envio', 'envío', 'llevan', 'entrega'], texto: 'Sí, hacemos domicilios en toda la zona: $4.000 y llega en unos 35 minutos 🛵' },
  { claves: ['menu', 'menú', 'carta', 'precio', 'cuesta', 'vale', 'que venden', 'qué venden'], texto: 'Hoy tenemos: bandeja paisa $28.000, sancocho $22.000 y ajiaco $20.000. ¿Cuál te gusta?' },
  { claves: ['pago', 'nequi', 'tarjeta', 'efectivo', 'pagar'], texto: 'Recibimos Nequi, Bancolombia y efectivo. Me envías el comprobante y lo verifico al instante ✅' },
  { claves: ['hola', 'buenas', 'buenos'], texto: '¡Hola! 😊 Soy el asistente de Sabor Paisa. Pregúntame por el menú, domicilios o pagos.' },
];
const SUGERENCIAS = ['¿Qué horario tienen?', '¿Hacen domicilios?', '¿Cómo puedo pagar?'];
const responder = (texto) => {
  const t = texto.toLowerCase();
  const r = RESPUESTAS.find((x) => x.claves.some((c) => t.includes(c)));
  return r ? r.texto : 'Eso lo respondería con el catálogo y las reglas de TU negocio. Crea tu cuenta gratis y pruébalo con tus propios productos 🚀';
};

export default function ChatMockup({ className = '' }) {
  const [extra, setExtra] = useState([]); // mensajes de la parte interactiva
  const [texto, setTexto] = useState('');
  const hora = () => new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const preguntar = (q) => {
    const t = (q ?? texto).trim();
    if (!t) return;
    setTexto('');
    setExtra((e) => [...e, { de: 'cliente', texto: t, hora: hora() }]);
    setTimeout(() => setExtra((e) => [...e, { de: 'bot', texto: responder(t), hora: hora() }]), 700);
  };
  const reducir = useReducedMotion();
  const [visibles, setVisibles] = useState(reducir ? GUION.length : 0);

  useEffect(() => {
    if (reducir) return undefined;
    let t;
    const paso = (n) => {
      setVisibles(n);
      // al terminar, deja leer un momento y reinicia el ciclo
      if (n < GUION.length) t = setTimeout(() => paso(n + 1), 1700);
    };
    t = setTimeout(() => paso(1), 600);
    return () => clearTimeout(t);
  }, [reducir]);

  return (
    <div
      className={`w-full max-w-[340px] mx-auto rounded-[28px] border border-border bg-bg shadow-[0_24px_60px_rgba(10,10,10,0.18)] overflow-hidden ${className}`}
      role="group"
      aria-label="Demostración: un cliente pide por WhatsApp y el bot toma el pedido. Puedes escribirle una pregunta"
    >
      <div className="bg-inverse text-inverse-text px-4 h-14 flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-accent-dim overflow-hidden flex items-end justify-center shrink-0">
          <Character name="nova" height={38} alt="" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-4 truncate">Restaurante Sabor Paisa</p>
          <p className="text-[11px] text-[#81C784] leading-4">● en línea · atendido por IA</p>
        </div>
        <Video size={18} className="ml-auto text-[#A0A0A0]" aria-hidden />
        <Phone size={18} className="text-[#A0A0A0]" aria-hidden />
      </div>

      <div className="h-[360px] p-3 flex flex-col justify-end gap-2 bg-bg2 overflow-y-auto" aria-live="polite">
        {[...GUION.slice(0, visibles), ...extra].map((m, i) => (
          <motion.div
            key={`${i}-${m.texto}`}
            initial={reducir ? false : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25 }}
            className={`max-w-[84%] px-3 py-2 rounded-2xl text-[13px] leading-5 shadow-sm ${
              m.de === 'cliente'
                ? 'self-end bg-accent-dim text-text rounded-br-md'
                : `self-start bg-bg border ${m.ok ? 'border-success/50' : 'border-border'} text-text rounded-bl-md`
            }`}
          >
            {m.texto}
            <span className="flex items-center justify-end gap-1 text-[10px] text-muted mt-0.5">
              {m.hora}
              {m.de === 'cliente' && <CheckCheck size={12} className="text-info" />}
            </span>
          </motion.div>
        ))}
      </div>

      {visibles >= GUION.length && (
        <div className="bg-bg border-t border-border p-2.5">
          <div className="flex gap-1.5 overflow-x-auto pb-2">
            {SUGERENCIAS.map((q) => (
              <button key={q} onClick={() => preguntar(q)} className="shrink-0 h-8 px-3 rounded-full bg-accent-dim text-accent text-xs font-semibold border-none cursor-pointer">
                {q}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); preguntar(); }} className="flex gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={120}
              placeholder="Pregúntale tú…"
              aria-label="Escribe una pregunta para el bot de ejemplo"
              className="flex-1 h-10 rounded-full border border-border bg-bg2 px-4 text-base md:text-sm text-text focus:outline-none focus:border-accent"
            />
            <button type="submit" aria-label="Enviar" className="w-10 h-10 rounded-full bg-accent text-white border-none cursor-pointer flex items-center justify-center">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
