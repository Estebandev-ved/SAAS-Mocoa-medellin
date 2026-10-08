import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Smartphone, Clock, Shield, HelpCircle } from 'lucide-react';
import Illustration, { Character } from './Illustration';

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

            {/* Lucía habla: el mensaje es su diálogo */}
            <div className="flex items-end gap-2 mt-10 mb-12">
              <motion.div
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="shrink-0 -mb-1"
              >
                <Character name="lucia" height={250} alt="Lucía, de atención al cliente, te responde" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: 0.25 }}
                style={{ transformOrigin: 'bottom left' }}
                className="relative bg-white border border-border rounded-2xl rounded-bl-md p-5 mb-24 max-w-sm"
              >
                <span className="absolute -left-2 bottom-4 w-4 h-4 bg-white border-l border-b border-border rotate-45 max-sm:hidden" />
                <p className="text-xs font-semibold tracking-[0.04em] text-accent uppercase mb-2">Lucía · Atención al cliente</p>
                <p className="text-text text-base leading-6">
                  ¡Hola! Cuéntanos sobre tu negocio y en menos de 24 horas te enviamos una propuesta personalizada con demostración incluida.
                </p>
              </motion.div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
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
            className="bg-bg2 border border-border p-10 rounded-3xl relative overflow-hidden"
          >
            {submitted ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-10"
              >
                <div className="flex justify-center mb-6">
                  <Illustration name="exito" size={180} alt="Sofía celebra: mensaje recibido" />
                </div>
                <h3 className="text-2xl font-bold mb-4">¡Mensaje Recibido!</h3>
                <p className="text-muted">Un experto se contactará contigo en menos de 24 horas por WhatsApp.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-muted uppercase tracking-[0.04em]">Nombre</label>
                    <input required className="bg-bg3 border border-border p-4 rounded-xl text-sm focus:border-accent outline-none" placeholder="Tu nombre" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-muted uppercase tracking-[0.04em]">WhatsApp</label>
                    <input required className="bg-bg3 border border-border p-4 rounded-xl text-sm focus:border-accent outline-none" placeholder="+57 300 0000000" />
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-muted uppercase tracking-[0.04em]">Tipo de negocio</label>
                  <select className="bg-bg3 border border-border p-4 rounded-xl text-sm focus:border-accent outline-none appearance-none">
                    <option>Restaurante / Comida</option>
                    <option>Tienda / Retail</option>
                    <option>Servicios Profesionales</option>
                    <option>Salud & Bienestar</option>
                    <option>Otro</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs text-muted uppercase tracking-[0.04em]">Tu Negocio</label>
                  <textarea rows="4" className="bg-bg3 border border-border p-4 rounded-xl text-sm focus:border-accent outline-none" placeholder="¿Qué te gustaría automatizar?"></textarea>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="bg-accent text-bg py-5 rounded-2xl text-sm font-black tracking-[0.04em] cursor-pointer border-none flex items-center justify-center gap-3"
                >
                  ENVIAR & AGENDAR DEMO <Send size={18} />
                </motion.button>
              </form>
            )}

          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
