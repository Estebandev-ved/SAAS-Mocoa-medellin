import React from 'react';
import { motion } from 'framer-motion';

const Ticker = () => {
  const businessTypes = [
    'Restaurantes', 'Tiendas de Retail', 'Spas & Estética', 'Gimnasios',
    'Floristerías', 'Ropa & Moda', 'Inmobiliarias', 'Reposterías',
    'Clínicas Médicas', 'Ferreterías', 'Empresas de Domicilios', 'Centros de Belleza'
  ];

  // Double the array for seamless loop
  const duplicatedItems = [...businessTypes, ...businessTypes, ...businessTypes];

  return (
    <div className="overflow-hidden border-y border-border bg-bg2 py-5 relative">
      <motion.div 
        className="flex whitespace-nowrap min-w-max"
        animate={{ x: [0, -2000] }}
        transition={{ 
          repeat: Infinity, 
          duration: 40, 
          ease: "linear" 
        }}
      >
        {duplicatedItems.map((item, i) => (
          <div 
            key={i} 
            className="flex items-center gap-4 px-12 border-r border-border/30 font-mono text-[10px] text-muted uppercase tracking-[0.3em] font-bold"
          >
            <span className="w-1 h-1 rounded-full bg-accent" />
            {item}
          </div>
        ))}
      </motion.div>
      <div className="absolute left-0 top-0 bottom-0 w-48 bg-gradient-to-r from-bg2 to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-48 bg-gradient-to-l from-bg2 to-transparent z-10" />
    </div>
  );
};

export default Ticker;

