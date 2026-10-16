import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCheck, Phone, Video } from 'lucide-react';
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

export default function ChatMockup({ className = '' }) {
  const reducir = useReducedMotion();
  const [visibles, setVisibles] = useState(reducir ? GUION.length : 0);

  useEffect(() => {
    if (reducir) return undefined;
    let t;
    const paso = (n) => {
      setVisibles(n);
      // al terminar, deja leer un momento y reinicia el ciclo
      t = setTimeout(() => paso(n >= GUION.length ? 0 : n + 1), n >= GUION.length ? 5000 : 1700);
    };
    t = setTimeout(() => paso(1), 600);
    return () => clearTimeout(t);
  }, [reducir]);

  return (
    <div
      className={`w-full max-w-[340px] mx-auto rounded-[28px] border border-border bg-bg shadow-[0_24px_60px_rgba(10,10,10,0.18)] overflow-hidden ${className}`}
      role="img"
      aria-label="Ejemplo: un cliente pide dos bandejas por WhatsApp, el bot toma el pedido y verifica el comprobante de pago"
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

      <div className="h-[360px] p-3 flex flex-col justify-end gap-2 bg-bg2 overflow-hidden" aria-hidden="true">
        {GUION.slice(0, visibles).map((m, i) => (
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
    </div>
  );
}
