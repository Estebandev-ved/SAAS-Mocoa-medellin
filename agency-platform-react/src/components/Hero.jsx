import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Play, ArrowRight, Sparkles } from 'lucide-react';
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
    { target: 300, suffix: '%', label: 'MÁS VENTAS' },
    { target: 24, suffix: '/7', label: 'DISPONIBILIDAD', isFixed: true },
    { target: 48, suffix: 'hrs', label: 'SETUP LIVE' }
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
    <section id="hero" className="min-h-screen flex items-center justify-center text-center relative overflow-hidden pt-32 pb-24 px-6">
      {/* Dynamic Grid Background */}
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg via-transparent to-bg" />
      </div>

      <motion.div 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="relative z-10 max-w-5xl mx-auto"
      >
        {/* Personaje de bienvenida */}
        <motion.div variants={itemVariants} className="flex justify-center mb-8">
          <Illustration name="bienvenida" size={200} alt="Sofía te da la bienvenida a NOMA" />
        </motion.div>

        {/* Label */}
        <motion.div
          variants={itemVariants}
          className="inline-flex items-center gap-3 bg-accent-dim border border-border px-4 h-7 rounded-full text-xs tracking-[0.04em] mb-10 text-accent font-semibold uppercase"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          PLATAFORMA SAAS DE AUTOMATIZACIÓN
        </motion.div>

        {/* Title */}
        <motion.h1 
          variants={itemVariants}
          className="font-head text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-8 tracking-[-0.02em]"
        >
          El sistema nervioso<br />
          <span className="text-accent underline decoration-accent/10">de tu negocio</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p 
          variants={itemVariants}
          className="text-muted text-lg max-w-2xl mx-auto mb-12 leading-7"
        >
          Un ecosistema completo de automatización inteligente — desde el primer WhatsApp hasta el reporte de ventas con <span className="text-text">{branding.name}</span>.
        </motion.p>

        {/* Buttons */}
        <motion.div 
          variants={itemVariants}
          className="flex flex-wrap justify-center gap-6 mb-24"
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="bg-accent hover:bg-accent2 text-white h-12 px-8 rounded-xl text-sm font-semibold flex items-center gap-3 cursor-pointer border-none transition-colors"
            onClick={() => document.getElementById('ecosistema')?.scrollIntoView({ behavior: 'smooth' })}
          >
             Ver ecosistema <ArrowRight size={16} />
          </motion.button>
          
          <motion.button
            className="bg-white hover:bg-bg2 text-text h-12 px-8 rounded-xl border border-[#C9C9C9] text-sm font-semibold transition-colors cursor-pointer"
            onClick={() => document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Agendar demo
          </motion.button>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
          variants={itemVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-0 divide-x-0 md:divide-x divide-border"
        >
          {stats.map((stat, i) => (
            <div key={i} className="px-12">
              <div className="font-head text-5xl md:text-6xl font-black text-accent mb-2">
                {stat.isFixed ? stat.target + stat.suffix : <Counter value={stat.target} suffix={stat.suffix} />}
              </div>
              <div className="text-xs tracking-[0.04em] text-muted uppercase font-semibold">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;

