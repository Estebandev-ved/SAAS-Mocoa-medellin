import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Play, ArrowRight, Sparkles } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

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
        {/* Label */}
        <motion.div 
          variants={itemVariants}
          className="inline-flex items-center gap-3 bg-accent-dim border border-border px-5 py-2 rounded-full text-[10px] font-mono tracking-[0.2em] mb-10 text-accent font-bold"
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
          className="font-head text-6xl md:text-8xl lg:text-9xl font-black leading-[0.9] mb-8 tracking-tighter"
        >
          El sistema nervioso<br />
          <span className="text-accent underline decoration-accent/10">de tu negocio</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p 
          variants={itemVariants}
          className="text-muted text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed font-medium"
        >
          Un ecosistema completo de automatización inteligente — desde el primer WhatsApp hasta el reporte de ventas con <span className="text-text">{branding.name}</span>.
        </motion.p>

        {/* Buttons */}
        <motion.div 
          variants={itemVariants}
          className="flex flex-wrap justify-center gap-6 mb-24"
        >
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(0,255,209,0.3)' }}
            whileTap={{ scale: 0.95 }}
            className="bg-accent text-bg px-10 py-5 rounded-2xl font-mono text-xs font-black tracking-widest flex items-center gap-3 cursor-pointer border-none shadow-xl"
            onClick={() => document.getElementById('ecosistema')?.scrollIntoView({ behavior: 'smooth' })}
          >
             VER ECOSISTEMA <ArrowRight size={16} />
          </motion.button>
          
          <motion.button
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
            className="bg-transparent text-text border-2 border-border px-10 py-5 rounded-2xl font-mono text-xs font-black tracking-widest transition-all cursor-pointer"
            onClick={() => document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })}
          >
            AGENDAR DEMO
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
              <div className="text-[10px] font-mono tracking-[0.3em] text-muted uppercase font-bold">
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

