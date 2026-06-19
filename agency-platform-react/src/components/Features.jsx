import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Package, 
  Bell, 
  BarChart3, 
  Palette, 
  ShieldCheck 
} from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, desc, tags }) => (
  <motion.div 
    whileHover={{ backgroundColor: 'var(--glass)' }}
    className="bg-bg2 p-10 border-b border-r border-border first:rounded-tl-2xl last:rounded-br-2xl flex flex-col gap-6"
  >
    <div className="w-12 h-12 rounded-xl bg-accent-dim border border-border flex items-center justify-center text-accent">
      <Icon size={24} />
    </div>
    <div>
      <h3 className="font-head text-2xl font-bold mb-3">{title}</h3>
      <p className="text-muted text-sm leading-relaxed mb-6">{desc}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <span key={tag} className="font-mono text-[10px] uppercase tracking-wider bg-accent-dim text-accent border border-border px-3 py-1 rounded-full">
            {tag}
          </span>
        ))}
      </div>
    </div>
  </motion.div>
);

const Features = () => {
  const features = [
    {
      icon: MessageSquare,
      title: "Bot de WhatsApp con IA",
      desc: "Responde automáticamente a clientes, detecta pedidos, gestiona el flujo de pago y confirma entregas. Disponible 24/7, nunca se cansa.",
      tags: ["Baileys", "OpenAI GPT", "Multi-idioma"]
    },
    {
      icon: Package,
      title: "Gestión de Pedidos",
      desc: "Panel web con todos los pedidos en tiempo real. Filtra, busca, exporta a CSV y marca entregas con un clic.",
      tags: ["MySQL", "Node.js", "Tiempo Real"]
    },
    {
      icon: Bell,
      title: "Notificaciones Automáticas",
      desc: "Correos y alertas instantáneas al dueño del negocio cada vez que llega un pedido nuevo o se completa un pago.",
      tags: ["SMTP", "WebSockets"]
    },
    {
      icon: BarChart3,
      title: "Análisis en Tiempo Real",
      desc: "Dashboard con ventas por día, mes y producto. Gráficas interactivas para tomar decisiones rápidas.",
      tags: ["Charts.js", "Analytics", "Exportar CSV"]
    },
    {
      icon: Palette,
      title: "100% Personalizable",
      desc: "Tu logo, tus colores, tu nombre de marca. El cliente verá una solución construida específicamente para él.",
      tags: ["White-label", "Branding"]
    },
    {
      icon: ShieldCheck,
      title: "Seguro & Escalable",
      desc: "Infraestructura en Python + Node.js + MySQL con autenticación JWT, backups automáticos y arquitectura preparada para crecer.",
      tags: ["Python", "JWT", "MySQL"]
    }
  ];

  return (
    <section id="features" className="py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            CARACTERÍSTICAS
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="section-title"
          >
            Todo lo que tu negocio necesita,<br /><span className="text-accent">ya automatizado</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="section-sub mx-auto"
          >
            Desde el primer mensaje de WhatsApp hasta el reporte de ventas del mes, lo gestionamos todo.
          </motion.p>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-3 border-t border-l border-border rounded-2xl overflow-hidden"
        >
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
