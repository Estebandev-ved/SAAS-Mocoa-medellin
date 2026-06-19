import React from 'react';
import { Layers, Instagram, Twitter, Linkedin, Mail } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

const Footer = () => {
  const { branding } = useBranding();

  return (
    <footer className="bg-bg2 border-t border-border pt-20 pb-10 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded bg-accent flex items-center justify-center">
                <Layers size={18} className="text-bg" />
              </div>
              <span className="font-mono font-bold tracking-[0.2em]">{branding.name}</span>
            </div>
            <p className="text-muted text-sm max-w-sm leading-relaxed mb-8">
              Automatización inteligente por WhatsApp. Vende más, trabaja menos. 
              Tecnología IA de vanguardia para negocios que buscan escalar sin fricción.
            </p>
            <div className="flex gap-4">
              {[Instagram, Twitter, Linkedin, Mail].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted hover:text-accent hover:border-accent transition-all">
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-mono text-xs font-bold text-text uppercase tracking-widest mb-6">Producto</h4>
            <ul className="flex flex-col gap-4 list-none p-0">
              <li><a href="#features" className="text-muted hover:text-accent text-sm no-underline transition-colors">Características</a></li>
              <li><a href="#process" className="text-muted hover:text-accent text-sm no-underline transition-colors">Cómo funciona</a></li>
              <li><a href="#interactive" className="text-muted hover:text-accent text-sm no-underline transition-colors">Demo en Vivo</a></li>
              <li><a href="#pricing" className="text-muted hover:text-accent text-sm no-underline transition-colors">Precios</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-mono text-xs font-bold text-text uppercase tracking-widest mb-6">Empresa</h4>
            <ul className="flex flex-col gap-4 list-none p-0">
              <li><a href="#" className="text-muted hover:text-accent text-sm no-underline transition-colors">Sobre nosotros</a></li>
              <li><a href="#" className="text-muted hover:text-accent text-sm no-underline transition-colors">Blog</a></li>
              <li><a href="#contact" className="text-muted hover:text-accent text-sm no-underline transition-colors">Contacto</a></li>
              <li><a href="#" className="text-muted hover:text-accent text-sm no-underline transition-colors">Privacidad</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-10 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-[11px] font-mono text-muted">
            © 2026 {branding.name} · Medellín, Colombia
          </div>
          <div className="text-[11px] font-mono text-muted flex gap-4 uppercase tracking-widest">
            <span>Hecho con IA</span>
            <span className="text-accent/30">•</span>
            <span>React</span>
            <span className="text-accent/30">•</span>
            <span>Vite</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
