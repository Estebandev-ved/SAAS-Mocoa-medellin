import React from 'react';
import { motion } from 'framer-motion';
import { Palette, Type, Moon, Sun, Monitor, Circle } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

const Customizer = () => {
  const { branding, updateBranding } = useBranding();

  const primaryColors = [
    { name: 'Cian', hex: '#00FFD1' },
    { name: 'Violeta', hex: '#7C3AED' },
    { name: 'Azul', hex: '#3B82F6' },
    { name: 'Esmeralda', hex: '#10B981' },
    { name: 'Rojo', hex: '#EF4444' },
    { name: 'Ambar', hex: '#F59E0B' },
    { name: 'Rosa', hex: '#EC4899' },
  ];

  return (
    <section id="customize" className="py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="section-label">PERSONALIZACIÓN EN VIVO</div>
          <h2 className="section-title">Hazlo tuyo,<br /><span className="text-accent">para cada cliente</span></h2>
          <p className="section-sub mx-auto">Cambia el nombre y colores aquí mismo y mira cómo se transforma la plataforma en tiempo real.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Controls */}
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <label className="text-[11px] font-mono text-muted uppercase tracking-widest flex items-center gap-2">
                <Type size={14} /> Nombre del Negocio
              </label>
              <input 
                type="text" 
                value={branding.name}
                onChange={(e) => updateBranding({ name: e.target.value })}
                className="bg-bg2 border border-border text-text px-5 py-4 rounded-xl text-sm focus:outline-none focus:border-accent transition-colors w-full"
                placeholder="Nombre del negocio"
              />
            </div>

            <div className="flex flex-col gap-6">
              <label className="text-[11px] font-mono text-muted uppercase tracking-widest flex items-center gap-2">
                <Palette size={14} /> Color de Identidad Principal
              </label>
              <div className="flex flex-wrap gap-4">
                {primaryColors.map((color) => (
                  <motion.button
                    key={color.hex}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => updateBranding({ primary: color.hex, accent: color.hex })}
                    className={`w-10 h-10 rounded-full border-2 cursor-pointer transition-all ${
                      branding.primary === color.hex ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
                <div className="relative group">
                  <input 
                    type="color" 
                    value={branding.primary}
                    onChange={(e) => updateBranding({ primary: e.target.value, accent: e.target.value })}
                    className="w-10 h-10 rounded-full bg-transparent border-2 border-border cursor-pointer overflow-hidden p-0"
                  />
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-bg3 border border-border px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    HEX Custom
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-bg2/50 border border-border p-8 rounded-3xl">
              <label className="text-[11px] font-mono text-muted uppercase tracking-widest flex items-center gap-2 mb-6">
                <Monitor size={14} /> Sistema de Visualización
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => updateBranding({ theme: 'dark' })}
                  className={`flex items-center justify-center gap-3 py-4 rounded-xl font-mono text-xs font-bold transition-all border ${
                    branding.theme === 'dark' 
                      ? 'bg-accent text-bg border-accent shadow-[0_0_20px_rgba(0,255,209,0.2)]' 
                      : 'bg-bg3 text-muted border-border hover:border-accent/50'
                  }`}
                >
                  <Moon size={16} /> DARK MODE
                </button>
                <button
                  onClick={() => updateBranding({ theme: 'light' })}
                  className={`flex items-center justify-center gap-3 py-4 rounded-xl font-mono text-xs font-bold transition-all border ${
                    branding.theme === 'light' 
                      ? 'bg-accent text-bg border-accent shadow-[0_0_20px_rgba(0,255,209,0.2)]' 
                      : 'bg-bg3 text-muted border-border hover:border-accent/50'
                  }`}
                >
                  <Sun size={16} /> LIGHT MODE
                </button>
              </div>
            </div>
          </div>

          {/* Real-time Preview */}
          <div className="sticky top-32">
            <motion.div 
              layout
              className="bg-bg3 border border-border rounded-3xl overflow-hidden shadow-2xl relative"
            >
              {/* Fake Window Decor */}
              <div className="bg-bg2/80 p-5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div 
                    layout
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-inner"
                    style={{ backgroundColor: branding.primary, color: branding.theme === 'light' ? '#fff' : '#000' }}
                  >
                    {branding.logo}
                  </motion.div>
                  <span className="font-head font-bold text-sm tracking-tight">{branding.name}</span>
                </div>
                <div className="flex gap-4">
                  <Circle size={8} className="text-muted fill-muted" />
                  <Circle size={8} className="text-muted fill-muted" />
                </div>
              </div>

              <div className="p-8">
                <div className="text-[11px] text-muted font-mono tracking-widest mb-2">BIENVENIDO A</div>
                <motion.h3 
                  layout
                  className="font-head text-4xl font-extrabold mb-6"
                  style={{ color: branding.primary }}
                >
                  {branding.name}
                </motion.h3>
                <motion.button 
                  layout
                  className="px-6 py-3 rounded-lg font-mono text-[11px] font-bold border-none cursor-pointer"
                  style={{ backgroundColor: branding.primary, color: branding.theme === 'light' ? '#fff' : '#000' }}
                >
                  VER PEDIDOS EN VIVO →
                </motion.button>

                <div className="grid grid-cols-3 gap-3 mt-10">
                  {[
                    { label: 'Ventas', value: '$245K' },
                    { label: 'Pedidos', value: '32' },
                    { label: 'Rating', value: '4.9' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-bg2/80 border border-border p-4 rounded-xl text-center">
                      <div className="font-mono text-lg font-bold" style={{ color: branding.primary }}>{stat.value}</div>
                      <div className="text-[9px] text-muted font-mono uppercase mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Premium Glow Overlay */}
              <div 
                className="absolute inset-x-0 bottom-0 h-32 opacity-20 pointer-events-none"
                style={{ background: `linear-gradient(to top, ${branding.primary}, transparent)` }}
              />
            </motion.div>
            <div className="mt-6 text-center text-[10px] font-mono text-muted uppercase tracking-[0.3em]">
              Vista previa del dashboard de cliente
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Customizer;
