import React from 'react';
import { motion } from 'framer-motion';
import { 
  ClipboardList, 
  Cpu, 
  Zap, 
  Rocket, 
  CheckCircle2,
  Clock
} from 'lucide-react';

const steps = [
  {
    time: "0h",
    title: "Briefing Estratégico",
    desc: "Definimos el ADN de tu marca, el tono de voz y los objetivos de conversión.",
    icon: ClipboardList,
    color: "bg-blue-500"
  },
  {
    time: "12h",
    title: "Arquitectura de Flujos",
    desc: "Mapeamos cada posible interacción y diseñamos los nodos de decisión de la IA.",
    icon: Cpu,
    color: "bg-purple-500"
  },
  {
    time: "24h",
    title: "Integración Técnica",
    desc: "Conectamos tu CRM, pasarelas de pago y bases de datos al ecosistema.",
    icon: Zap,
    color: "bg-yellow-500"
  },
  {
    time: "36h",
    title: "Entrenamiento & QA",
    desc: "Sometemos al bot a pruebas de estrés y refinamos su capacidad de respuesta.",
    icon: CheckCircle2,
    color: "bg-green-500"
  },
  {
    time: "48h",
    title: "Lanzamiento (Live)",
    desc: "El sistema entra en producción. Tu negocio ahora escala sin límites.",
    icon: Rocket,
    color: "bg-accent"
  }
];

const Timeline = () => {
  return (
    <section id="proceso" className="py-32 bg-bg2 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            NUESTRO MÉTODO
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="section-title"
          >
            De Cero a <span className="text-accent underline decoration-accent/20">Automatizado</span> en 48hs
          </motion.h2>
          <p className="section-sub mx-auto">
            Un proceso ágil, técnico y sin fricciones diseñado para dueños de negocio que no tienen tiempo que perder.
          </p>
        </div>

        <div className="relative max-w-5xl mx-auto">
          {/* Vertical line for mobile */}
          <div className="absolute left-[20px] md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-1/2" />
          
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
                    <p className="text-muted leading-relaxed">{step.desc}</p>
                  </div>
                </div>

                {/* Center Icon */}
                <div className="relative z-10">
                  <motion.div 
                    whileHover={{ scale: 1.2, rotate: 5 }}
                    className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-bg border border-border flex items-center justify-center text-accent shadow-[0_0_20px_rgba(0,0,255,0.1)] relative"
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

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mt-32 p-12 bg-bg rounded-3xl border border-border text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <Rocket size={150} />
          </div>
          <h3 className="font-head text-3xl font-bold mb-4">¿Listo para las próximas 48 horas?</h3>
          <p className="text-muted mb-8 max-w-xl mx-auto italic">
            "La diferencia entre un negocio que sobrevive y uno que escala es la velocidad con la que implementa tecnología."
          </p>
          <motion.button 
             whileHover={{ scale: 1.05 }}
             whileTap={{ scale: 0.95 }}
             onClick={() => document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })}
             className="bg-accent text-bg px-10 py-4 rounded-xl font-mono text-sm font-bold uppercase tracking-widest shadow-[0_0_30px_rgba(0,255,209,0.3)] border-none cursor-pointer"
          >
             Iniciar Onboarding Ahora
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
};

export default Timeline;
