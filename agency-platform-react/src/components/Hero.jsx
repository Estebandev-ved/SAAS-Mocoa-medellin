import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Play, ArrowRight, Check } from 'lucide-react';
import ChatMockup from './ChatMockup';
import { evento } from '../utils/analitica';
import { useBranding } from '../context/BrandingContext';
import Illustration from './Illustration';

const Counter = ({ value, suffix = "" }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest) + suffix);

  useEffect(() => {
    const controls = animate(count, value, { duration: 2, ease: "easeOut" });
    return controls.stop;
  }, [value]);

  return <motion.span>{rounded}</motion.span>;
};

const Hero = () => {
  const { branding } = useBranding();
  
  const stats = [
    { target: 300, suffix: '%', label: 'Más ventas' },
    { target: 24, suffix: '/7', label: 'Disponible', isFixed: true },
    { target: 48, suffix: 'hrs', label: 'Para estrenar' }
  ];

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <section id="hero" className="min-h-screen flex items-center relative overflow-hidden pt-28 pb-16 lg:pb-24 px-6">
      {/* Dynamic Grid Background */}
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg via-transparent to-bg" />
      </div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="relative z-10 max-w-7xl w-full mx-auto"
      >
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center gap-3 bg-accent-dim border border-border px-4 h-7 rounded-full text-xs tracking-[0.04em] mb-8 text-accent font-semibold uppercase"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              Un vendedor con IA en tu WhatsApp
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="font-head text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-6xl font-extrabold leading-[1.1] mb-6 tracking-[-0.02em]"
            >
              Tu WhatsApp vende solo,<br />
              <span className="text-accent underline decoration-accent/10">las 24 horas</span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-muted text-lg max-w-xl mx-auto lg:mx-0 mb-10 leading-7"
            >
              {branding.name} atiende a tus clientes, toma el pedido, revisa el comprobante de pago y despacha el domicilio. Tú solo ves las ventas llegar en tu panel.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-wrap justify-center lg:justify-start items-center gap-x-6 gap-y-4 mb-12">
              <Link
                to="/register"
                onClick={() => evento('cta_registro', { donde: 'hero' })}
                className="bg-accent hover:bg-accent2 text-white h-12 px-8 rounded-xl text-sm font-semibold inline-flex items-center gap-3 no-underline transition-colors"
              >
                Probar gratis 7 días <ArrowRight size={16} />
              </Link>
              <button
                className="bg-transparent text-text h-12 px-2 text-sm font-semibold inline-flex items-center gap-2 cursor-pointer border-none hover:text-accent transition-colors"
                onClick={() => document.getElementById('interactive')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <span className="w-9 h-9 rounded-full bg-accent-dim text-accent flex items-center justify-center"><Play size={14} fill="currentColor" /></span>
                Ver el bot en acción
              </button>
            </motion.div>

            <motion.ul variants={itemVariants} className="list-none p-0 m-0 flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2 text-sm text-muted mb-12">
              {['Sin tarjeta de crédito', 'Listo en 48 horas', 'Hecho para negocios en Colombia'].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check size={16} className="text-success" />{t}</li>
              ))}
            </motion.ul>

            <motion.div
              variants={itemVariants}
              className="grid grid-cols-3 gap-4 max-w-lg mx-auto lg:mx-0 border-t border-border pt-8"
            >
              {stats.map((stat, i) => (
                <div key={i}>
                  <div className="font-head text-3xl sm:text-4xl font-black text-accent mb-1">
                    {stat.isFixed ? stat.target + stat.suffix : <Counter value={stat.target} suffix={stat.suffix} />}
                  </div>
                  <div className="text-[11px] tracking-[0.04em] text-muted uppercase font-semibold">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div variants={itemVariants} className="relative">
            <div className="absolute -inset-6 rounded-[40px] bg-accent-dim blur-2xl opacity-70 -z-10" aria-hidden="true" />
            <ChatMockup />
            <div className="hidden sm:block absolute -left-6 -bottom-6">
              <Illustration name="bienvenida" size={110} framed={false} alt="Sofía te da la bienvenida" />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;

