import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ArrowRight, Star } from 'lucide-react';
import { Character } from './Illustration';

const PricingCard = ({ tier, price, desc, features, featured, isAnnual }) => {
  const displayPrice = isAnnual ? Math.round(price * 0.8) : price;

  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className={`relative p-8 flex flex-col gap-6 ${
        featured ? 'bg-bg3 border-2 border-accent z-10' : 'bg-bg border border-border'
      } first:rounded-l-2xl last:rounded-r-2xl max-lg:rounded-2xl`}
    >
      {featured && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-bg text-xs font-black px-4 py-1.5 rounded-full tracking-[0.04em] flex items-center gap-2">
          <Star size={12} fill="currentColor" /> MÁS POPULAR
        </div>
      )}
      <div className="text-xs text-muted uppercase tracking-[0.04em]">{tier}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-mono align-top mt-2">$</span>
        <motion.span 
          key={displayPrice}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`text-5xl font-head font-black ${featured ? 'text-accent' : ''}`}
        >
          {displayPrice.toLocaleString('es-CO')}
        </motion.span>
        <span className="text-muted font-mono text-sm">/mes</span>
      </div>
      <p className="text-muted text-sm leading-relaxed">{desc}</p>
      {isAnnual && (
        <span className="text-xs text-accent uppercase tracking-[0.04em] font-bold">Ahorras un 20% anual</span>
      )}
      <div className="h-px bg-border" />
      <ul className="flex flex-col gap-4 list-none p-0 flex-1">
        {features.map((f, i) => (
          <li key={i} className={`flex items-start gap-3 text-sm ${f.disabled ? 'text-muted/50' : 'text-text'}`}>
            {f.disabled ? <X size={16} className="text-muted mt-0.5 shrink-0" /> : <Check size={16} className="text-accent mt-0.5 shrink-0" />}
            {f.text}
          </li>
        ))}
      </ul>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full py-4 rounded-xl text-xs font-bold tracking-[0.04em] border-2 transition-all cursor-pointer ${
          featured ? 'bg-accent text-bg border-accent' : 'bg-transparent text-text border-border hover:border-accent hover:text-accent'
        }`}
        onClick={() => document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })}
      >
        OBTENER AHORA <ArrowRight size={14} className="inline ml-2" />
      </motion.button>
    </motion.div>
  );
};

const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      tier: "Emprendedor",
      price: 25000,
      desc: "Para llevar el inventario, las ventas y la plata de tu emprendimiento.",
      features: [
        { text: "Caja: inventario, ventas y plata" },
        { text: "Acceso con tu cuenta Antigravity" },
        { text: "Soporte por email" },
        { text: "Bot de WhatsApp con IA", disabled: true },
        { text: "Domicilios", disabled: true }
      ]
    },
    {
      tier: "Starter",
      price: 89000,
      desc: "Ideal para MVP o negocios que están empezando a automatizar.",
      features: [
        { text: "Bot de WhatsApp (IA Básica)" },
        { text: "Panel de pedidos Real-time" },
        { text: "Dashboard de ventas diario" },
        { text: "Branding personalizado" },
        { text: "Soporte 5 días", disabled: false },
        { text: "Integración de pagos", disabled: true },
        { text: "White Label completo", disabled: true }
      ]
    },
    {
      tier: "Professional",
      price: 189000,
      desc: "Nuestra solución estrella para negocios con alto volumen.",
      featured: true,
      features: [
        { text: "IA con razonamiento avanzado" },
        { text: "Todo de Plan Starter" },
        { text: "Integración Pasarelas (Bold/Wompi)" },
        { text: "Re-engagement automático" },
        { text: "Análisis de Sentimiento" },
        { text: "Soporte prioritario 7 días" },
        { text: "White Label completo", disabled: false }
      ]
    },
    {
      tier: "Enterprise",
      price: 449000,
      desc: "Arquitectura a medida para corporativos y agencias escala.",
      features: [
        { text: "Todo de Plan Professional" },
        { text: "API personalizada & Webhooks" },
        { text: "Canal IG/FB Messenger" },
        { text: "Múltiples unidades de negocio" },
        { text: "Gestor de cuenta dedicado" },
        { text: "Soporte 24/7 SLA" },
        { text: "Infraestructura Propia" }
      ]
    }
  ];

  return (
    <section id="pricing" className="py-32 px-6 bg-bg2/30 relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <Character name="sofia" height={200} alt="Sofía, la dueña del negocio, eligiendo su plan" />
          </div>
          <div className="section-label">INVERSIÓN</div>
          <h2 className="section-title">Planes que <span className="text-accent underline decoration-accent/20">Escalan</span> contigo</h2>
          
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-xs uppercase tracking-[0.04em] ${!isAnnual ? 'text-accent' : 'text-muted'}`}>Mensual</span>
            <button 
              onClick={() => setIsAnnual(!isAnnual)}
              className="w-14 h-7 bg-bg3 border border-border rounded-full p-1 relative transition-colors"
            >
              <motion.div 
                animate={{ x: isAnnual ? 28 : 0 }}
                className="w-5 h-5 bg-accent rounded-full"
              />
            </button>
            <span className={`text-xs uppercase tracking-[0.04em] ${isAnnual ? 'text-accent' : 'text-muted'}`}>Anual (-20%)</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-0 max-lg:gap-8 items-stretch">
          {plans.map((p, i) => (
            <PricingCard key={i} {...p} isAnnual={isAnnual} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;

