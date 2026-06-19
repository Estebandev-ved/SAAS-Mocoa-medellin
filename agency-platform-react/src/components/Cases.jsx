import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Clock, CheckCircle2 } from 'lucide-react';

const cases = [
  {
    name: "Floristería Pétalos",
    tag: "COMERCIO LOCAL",
    metric: "92% Automatización",
    before: "15 Pedidos/día",
    after: "45 Pedidos/día",
    quote: "Antes perdíamos clientes por no responder a tiempo en la noche. Ahora el bot cierra ventas mientras dormimos.",
    avatar: "FP"
  },
  {
    name: "Burger Master Co",
    tag: "GASTRONOMÍA",
    metric: "+45% Ventas",
    before: "Atención 10hs",
    after: "Atención 24/7",
    quote: "La integración con Bold y el panel de pedidos nos cambió la vida. El bot detecta el comprobante y confirma el envío solo.",
    avatar: "BM"
  },
  {
    name: "Reposteria Dulce",
    tag: "REPOSTERÍA",
    metric: "0 Errores",
    before: "Chat manual",
    after: "Todo fluido",
    quote: "Ya no hay confusiones con las direcciones o los sabores. El sistema es exacto y muy profesional.",
    avatar: "RD"
  }
];

const CaseCard = ({ c, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.1 }}
    className="bg-bg2 border border-border p-8 rounded-3xl hover:border-accent/40 transition-all group"
  >
    <div className="flex items-center gap-4 mb-8">
      <div className="w-14 h-14 rounded-2xl bg-accent text-bg flex items-center justify-center font-head font-bold text-xl shadow-[0_0_20px_rgba(0,255,209,0.2)]">
        {c.avatar}
      </div>
      <div>
        <h4 className="font-head text-lg font-bold text-text">{c.name}</h4>
        <span className="font-mono text-[10px] uppercase tracking-widest text-accent">{c.tag}</span>
      </div>
    </div>

    <div className="mb-8">
      <div className="flex items-center gap-2 text-accent mb-2">
        <TrendingUp size={18} />
        <span className="font-head text-2xl font-bold">{c.metric}</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-bg/40 p-4 rounded-2xl border border-border/50">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted mb-1">ANTES</p>
          <p className="text-sm font-semibold opacity-60">{c.before}</p>
        </div>
        <div className="bg-accent-dim p-4 rounded-2xl border border-accent/20">
          <p className="font-mono text-[9px] uppercase tracking-widest text-accent mb-1">AHORA</p>
          <p className="text-sm font-bold text-accent">{c.after}</p>
        </div>
      </div>
    </div>

    <p className="text-muted text-sm italic leading-relaxed relative pl-6 before:content-['\201C'] before:absolute before:left-0 before:top-[-10px] before:text-4xl before:text-accent/30 before:font-head">
      {c.quote}
    </p>
  </motion.div>
);

const Cases = () => {
  return (
    <section id="casos" className="py-32 bg-bg relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            CASOS DE ÉXITO
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="section-title"
          >
            Resultados que <span className="text-accent underline decoration-accent/20">Hablan</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="section-sub mx-auto"
          >
            No vendemos software, entregamos transformaciones operativas reales.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {cases.map((c, i) => (
            <CaseCard key={i} c={c} index={i} />
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-20 flex flex-wrap justify-center gap-12 border-t border-border pt-20"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-bg2">
                <CheckCircle2 size={24} className="text-accent" />
             </div>
             <p className="font-mono text-sm uppercase tracking-tighter"><span className="text-accent font-bold">+500k</span> Chats gestionados</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-bg2">
                <CheckCircle2 size={24} className="text-accent" />
             </div>
             <p className="font-mono text-sm uppercase tracking-tighter"><span className="text-accent font-bold">100%</span> Pagos seguros</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-bg2">
                <CheckCircle2 size={24} className="text-accent" />
             </div>
             <p className="font-mono text-sm uppercase tracking-tighter"><span className="text-accent font-bold">48hs</span> Promedio onboarding</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Cases;
