import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calculator, TrendingUp, DollarSign, Clock, Zap } from 'lucide-react';

const ROISimulator = () => {
  const [orders, setOrders] = useState(20);
  const [ticket, setTicket] = useState(45000);
  const [automation, setAutomation] = useState(70);
  
  const [results, setResults] = useState({
    monthlySavings: 0,
    annualSavings: 0,
    timeSaved: 0,
    roi: 0
  });

  const calculateROI = () => {
    // Basic assumptions
    const costPerManualOrder = 3500; // Average cost in COP for manual handling (time, errors, etc)
    const monthlySubscription = 450000; // Estimated monthly cost of the system
    
    const monthlyOrders = orders * 30;
    const manualTotalCost = monthlyOrders * costPerManualOrder;
    const automatedOrders = (automation / 100) * monthlyOrders;
    
    const grossSavings = automatedOrders * costPerManualOrder;
    const netMonthlySavings = grossSavings - monthlySubscription;
    const netAnnualSavings = netMonthlySavings * 12;
    
    // Time saved (assume 10 mins per manual order)
    const hoursSaved = (automatedOrders * 10) / 60;
    
    // ROI calculation: (Net Profit / Cost) * 100
    const roiPercentage = monthlySubscription > 0 ? (netMonthlySavings / monthlySubscription) * 100 : 0;

    setResults({
      monthlySavings: Math.max(0, netMonthlySavings),
      annualSavings: Math.max(0, netAnnualSavings),
      timeSaved: Math.round(hoursSaved),
      roi: Math.round(roiPercentage)
    });
  };

  useEffect(() => {
    calculateROI();
  }, [orders, ticket, automation]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <section id="simulador" className="py-32 bg-bg relative overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="section-label"
          >
            SIMULADOR DE IMPACTO
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="section-title"
          >
            Calcula tu <span className="text-accent underline decoration-accent/20">Potencial</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="section-sub mx-auto"
          >
            Descubre cuánto tiempo y dinero estás perdiendo por no automatizar tus flujos de trabajo.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start max-w-6xl mx-auto">
          {/* Inputs */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-bg2 p-10 rounded-3xl border border-border shadow-2xl relative"
          >
            <div className="absolute -top-6 -left-6 w-12 h-12 bg-accent rounded-2xl flex items-center justify-center text-bg shadow-[0_0_20px_rgba(0,255,209,0.3)]">
              <Calculator size={24} />
            </div>

            <div className="space-y-10">
              {/* Orders Slider */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <label className="font-mono text-xs uppercase tracking-widest text-muted">Pedidos por día</label>
                  <span className="text-2xl font-head font-bold text-accent">{orders}</span>
                </div>
                <input 
                  type="range" min="1" max="250" value={orders}
                  onChange={(e) => setOrders(parseInt(e.target.value))}
                  className="w-full accent-accent bg-bg h-2 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Ticket Slider */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <label className="font-mono text-xs uppercase tracking-widest text-muted">Ticket Promedio</label>
                  <span className="text-2xl font-head font-bold text-accent">{formatCurrency(ticket)}</span>
                </div>
                <input 
                  type="range" min="5000" max="500000" step="5000" value={ticket}
                  onChange={(e) => setTicket(parseInt(e.target.value))}
                  className="w-full accent-accent bg-bg h-2 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Automation Slider */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <label className="font-mono text-xs uppercase tracking-widest text-muted">Nivel de Automatización</label>
                  <span className="text-2xl font-head font-bold text-accent">{automation}%</span>
                </div>
                <input 
                  type="range" min="10" max="95" value={automation}
                  onChange={(e) => setAutomation(parseInt(e.target.value))}
                  className="w-full accent-accent bg-bg h-2 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </motion.div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            <ResultCard 
              icon={DollarSign}
              label="Ahorro Mensual Est."
              value={formatCurrency(results.monthlySavings)}
              desc="Eficiencia operativa neta"
              delay={0.1}
            />
            <ResultCard 
              icon={TrendingUp}
              label="Impacto Anual"
              value={formatCurrency(results.annualSavings)}
              desc="Retorno total proyectado"
              color="text-accent"
              delay={0.2}
            />
            <ResultCard 
              icon={Clock}
              label="Tiempo Recuperado"
              value={`${results.timeSaved}hs`}
              desc="Mensuales de trabajo manual"
              delay={0.3}
            />
            <ResultCard 
              icon={Zap}
              label="ROI Proyectado"
              value={`${results.roi}%`}
              desc="Sobre inversión tecnológica"
              color="text-accent"
              delay={0.4}
            />
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center"
        >
          <p className="text-muted text-sm font-mono uppercase tracking-widest bg-bg2 d-inline-block px-8 py-3 rounded-full border border-border italic mb-8">
            * Cifras estimadas basadas en costos operativos estándar de comercio electrónico en LATAM.
          </p>
          <motion.button 
            whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(0,255,209,0.2)' }}
            whileTap={{ scale: 0.95 }}
            className="bg-accent text-bg px-12 py-5 rounded-2xl font-head font-bold text-lg cursor-pointer border-none"
            onClick={() => document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })}
          >
            SOLICITAR PLAN DE ESCALADO
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
};

const ResultCard = ({ icon: Icon, label, value, desc, color = "text-text", delay = 0 }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay }}
    className="bg-bg3 border border-border p-8 rounded-3xl flex flex-col justify-between hover:border-accent/40 transition-colors"
  >
    <div className="w-10 h-10 rounded-xl bg-accent-dim border border-border flex items-center justify-center text-accent mb-6">
      <Icon size={20} />
    </div>
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">{label}</p>
      <h4 className={`font-head text-3xl font-bold mb-2 ${color}`}>{value}</h4>
      <p className="text-muted text-xs leading-none">{desc}</p>
    </div>
  </motion.div>
);

export default ROISimulator;
