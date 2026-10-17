import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { evento } from '../utils/analitica';

// Número de ventas por WhatsApp (solo dígitos, con indicativo: 573001234567). Sin la variable no se muestra el botón.
const WA = (import.meta.env.VITE_WHATSAPP_VENTAS || '').replace(/\D/g, '');

// Landing: botón flotante de WhatsApp + barra fija "Crear cuenta" en celular (aparece tras pasar el hero).
export default function FloatingActions() {
  const [pasoHero, setPasoHero] = useState(false);

  useEffect(() => {
    const fn = () => setPasoHero(window.scrollY > window.innerHeight * 0.7);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <>
      {WA && (
        <a
          href={`https://wa.me/${WA}?text=${encodeURIComponent('Hola, quiero saber cómo funciona Antigravity para mi negocio')}`}
          onClick={() => evento('click_whatsapp')}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Escríbenos por WhatsApp"
          className={`fixed right-4 z-[90] w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(37,211,102,0.45)] hover:scale-105 transition-transform ${
            pasoHero ? 'bottom-24 md:bottom-6' : 'bottom-6'
          }`}
        >
          <MessageCircle size={28} />
        </a>
      )}

      <AnimatePresence>
        {pasoHero && (
          <motion.div
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 80 }}
            className="md:hidden fixed bottom-0 inset-x-0 z-[85] bg-inverse border-t border-white/10 px-4 pt-3 pb-safe"
          >
            <Link
              to="/register"
              onClick={() => evento('cta_registro', { donde: 'barra_movil' })}
              className="mb-3 flex items-center justify-center gap-2 h-12 rounded-xl bg-accent text-white text-sm font-semibold no-underline"
            >
              Probar gratis 7 días <ArrowRight size={16} />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
