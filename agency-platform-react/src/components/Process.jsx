import React from 'react';
import { motion } from 'framer-motion';
import { 
  ClipboardList, 
  Cpu, 
  Zap, 
  Rocket, 
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';

const methodology = [
  {
    num: "01",
    title: "Análisis del Negocio",
    desc: "Estudiamos tu operación, productos y objetivos para diseñar la estrategia perfecta."
  },
  {
    num: "02",
    title: "Configuración Personalizada",
    desc: "Entrenamos la IA con tu catálogo, precios, políticas y estilo de comunicación."
  },
  {
    num: "03",
    title: "Integración y Pruebas",
    desc: "Conectamos con tus sistemas de pago, inventario y herramientas existentes."
  },
  {
    num: "04",
    title: "¡Lanzamiento en 48h!",
    desc: "Tu negocio automatizado y funcionando. Sin complicaciones, sin esperas."
  }
];

const steps = [
  {
    time: "0h",
    title: "Briefing Estratégico",
    desc: "Definimos el ADN de tu marca, el tono de voz y los objetivos de conversión.",
    icon: ClipboardList
  },
  {
    time: "12h",
    title: "Arquitectura de Flujos",
    desc: "Mapeamos cada posible interacción y diseñamos los nodos de decisión de la IA.",
    icon: Cpu
  },
  {
    time: "24h",
    title: "Integración Técnica",
    desc: "Conectamos tu CRM, pasarelas de pago y bases de datos al ecosistema.",
    icon: Zap
  },
  {
    time: "36h",
    title: "Entrenamiento & QA",
    desc: "Sometemos al bot a pruebas de estrés y refinamos su capacidad de respuesta.",
    icon: CheckCircle2
  },
  {
    time: "48h",
    title: "Lanzamiento (Live)",
    desc: "El sistema entra en producción. Tu negocio ahora escala sin límites.",
    icon: Rocket
  }
];

const Process = () => {
  return (
    <section id="proceso" className="py-32 bg-bg relative overflow-hidden">
      <div className="container mx-auto px-6">
        {/* Methodology Header */}
        <div className="text-center mb-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            IMPLEMENTACIÓN
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="section-title"
          >
            En Solo <span className="text-accent underline decoration-accent/20">4 Pasos</span>
          </motion.h2>
        </div>

        {/* Methodology Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-40">
          {methodology.map((item, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-bg2 border border-border p-10 rounded-3xl relative group hover:border-accent/50 transition-colors"
            >
              <div className="font-head text-5xl font-black text-accent/10 absolute top-6 right-8 group-hover:text-accent/20 transition-colors">
                {item.num}
              </div>
              <h4 className="font-head text-xl font-bold mb-4 pr-10">{item.title}</h4>
              <p className="text-muted text-sm leading-relaxed">{item.desc}</p>
              {i < 3 && (
                <div className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 z-10 text-accent/30">
                   <ArrowRight size={24} />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Timeline Header */}
        <div className="text-center mb-24">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            CRONOGRAMA
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="section-title"
          >
            Tus Primeras 48 Horas
          </motion.h2>
        </div>

        {/* Timeline Component Logic */}
        <div className="relative max-w-5xl mx-auto">
          {/* Vertical line for mobile */}
          <div className="absolute left-[20px] md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-1/2 opacity-30" />
          
          <div className="space-y-12 md:space-y-24">
            {steps.map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className={`flex flex-col md:flex-row items-center gap-8 ${
                  i % 2 === 0 ? 'md:flex-row-reverse' : ''
                }`}
              >
                {/* Content */}
                <div className="flex-1 w-full text-left md:text-right">
                  <div className={`md:px-8 ${i % 2 === 0 ? 'md:text-left' : 'md:text-right'}`}>
                    <div className="inline-flex items-center gap-2 mb-2">
                       <Clock size={14} className="text-accent" />
                       <span className="font-mono text-xs font-bold text-accent uppercase tracking-widest">{step.time}</span>
                    </div>
                    <h4 className="font-head text-2xl font-bold mb-3">{step.title}</h4>
                    <p className="text-muted leading-relaxed text-sm">{step.desc}</p>
                  </div>
                </div>

                {/* Center Icon */}
                <div className="relative z-10">
                  <motion.div 
                    whileHover={{ scale: 1.2, rotate: 5 }}
                    className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-bg border border-border flex items-center justify-center text-accent shadow-[0_0_20px_rgba(0,255,209,0.1)] relative"
                  >
                    <div className="absolute inset-0 bg-accent/5 rounded-2xl animate-pulse" />
                    <step.icon size={24} className="md:w-8 md:h-8" />
                  </motion.div>
                </div>

                {/* Spacer for empty side */}
                <div className="flex-1 hidden md:block" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA Banner */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mt-40 p-12 bg-bg2 rounded-[32px] border border-border text-center relative overflow-hidden group shadow-2xl"
        >
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-accent opacity-5 blur-[100px] group-hover:opacity-10 transition-opacity" />
          <h3 className="font-head text-4xl font-black mb-6">¿Listo para las próximas 48 horas?</h3>
          <p className="text-muted mb-10 max-w-xl mx-auto italic text-lg leading-relaxed">
            "La diferencia entre un negocio que sobrevive y uno que escala es la velocidad con la que implementa tecnología."
          </p>
          <motion.button 
             whileHover={{ scale: 1.05 }}
             whileTap={{ scale: 0.95 }}
             onClick={() => document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })}
             className="bg-accent text-bg px-12 py-5 rounded-2xl font-mono text-xs font-black uppercase tracking-widest shadow-[0_0_30px_rgba(0,255,209,0.3)] border-none cursor-pointer"
          >
             Iniciar Onboarding Ahora
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
};

export default Process;
