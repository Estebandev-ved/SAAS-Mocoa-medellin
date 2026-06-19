import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle, Smartphone, Clock, Shield, HelpCircle } from 'lucide-react';

const Contact = () => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <div className="section-label">¿LISTO PARA EMPEZAR?</div>
            <h2 className="section-title">Automaticemos tu<br /><span className="text-accent">negocio hoy</span></h2>
            <p className="text-muted text-lg mb-10 max-w-md">Cuéntanos sobre tu negocio y en menos de 24 horas te enviamos una propuesta personalizada con demostración incluida.</p>
            
            <div className="flex flex-col gap-6">
              {[
                { icon: Shield, text: 'Sin permanencia' },
                { icon: Clock, text: 'Setup en 48 horas' },
                { icon: Smartphone, text: 'Demo gratuita' },
                { icon: HelpCircle, text: 'Soporte post-lanzamiento' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 text-sm font-medium">
                  <div className="text-accent"><item.icon size={20} /></div>
                  {item.text}
                </div>
              ))}
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className="bg-bg2 border border-border p-10 rounded-3xl shadow-2xl relative overflow-hidden"
          >
            {submitted ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-10"
              >
                <div className="w-20 h-20 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={48} />
                </div>
                <h3 className="text-2xl font-bold mb-4">¡Mensaje Recibido!</h3>
                <p className="text-muted">Un experto se contactará contigo en menos de 24 horas por WhatsApp.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono text-muted uppercase tracking-widest">Nombre</label>
                    <input required className="bg-bg3 border border-border p-4 rounded-xl text-sm focus:border-accent outline-none" placeholder="Tu nombre" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono text-muted uppercase tracking-widest">WhatsApp</label>
                    <input required className="bg-bg3 border border-border p-4 rounded-xl text-sm focus:border-accent outline-none" placeholder="+57 300 0000000" />
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-mono text-muted uppercase tracking-widest">Tipo de negocio</label>
                  <select className="bg-bg3 border border-border p-4 rounded-xl text-sm focus:border-accent outline-none appearance-none">
                    <option>Restaurante / Comida</option>
                    <option>Tienda / Retail</option>
                    <option>Servicios Profesionales</option>
                    <option>Salud & Bienestar</option>
                    <option>Otro</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-mono text-muted uppercase tracking-widest">Tu Negocio</label>
                  <textarea rows="4" className="bg-bg3 border border-border p-4 rounded-xl text-sm focus:border-accent outline-none" placeholder="¿Qué te gustaría automatizar?"></textarea>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,255,209,0.3)' }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="bg-accent text-bg py-5 rounded-2xl font-mono text-sm font-black tracking-widest cursor-pointer border-none flex items-center justify-center gap-3"
                >
                  ENVIAR & AGENDAR DEMO <Send size={18} />
                </motion.button>
              </form>
            )}
            
            {/* Background Glow */}
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-accent/5 blur-[80px] rounded-full pointer-events-none" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
