import React from 'react';
import { Layers, Instagram, Facebook, Youtube } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBranding } from '../context/BrandingContext';
import { REDES } from '../siteConfig';

// lucide-react no trae el logo de TikTok
const TikTok = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.6 6.7a4.8 4.8 0 0 1-3.8-4.2h-3.4v13.3a2.9 2.9 0 1 1-2-2.8V9.5a6.3 6.3 0 1 0 5.4 6.3V9.3a8.2 8.2 0 0 0 4.8 1.5V7.4a4.8 4.8 0 0 1-1-.7z" />
  </svg>
);

const REDES_FOOTER = [
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
  { key: 'tiktok', label: 'TikTok', Icon: TikTok },
];

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
              <span className="font-bold tracking-[0.04em]">{branding.name}</span>
            </div>
            <p className="text-muted text-sm max-w-sm leading-relaxed mb-8">
              Automatización inteligente por WhatsApp. Vende más, trabaja menos. 
              Tecnología IA de vanguardia para negocios que buscan escalar sin fricción.
            </p>
            <div className="flex gap-4">
              {REDES_FOOTER.map(({ key, label, Icon }) => {
                const url = REDES[key];
                return (
                  <a
                    key={key}
                    href={url || undefined}
                    aria-label={label}
                    title={label}
                    {...(url ? { target: '_blank', rel: 'noopener noreferrer' } : { 'aria-disabled': true })}
                    className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted hover:text-accent hover:border-accent transition-all"
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-text uppercase tracking-[0.04em] mb-6">Producto</h4>
            <ul className="flex flex-col gap-4 list-none p-0">
              <li><a href="#features" className="text-muted hover:text-accent text-sm no-underline transition-colors">Características</a></li>
              <li><a href="#process" className="text-muted hover:text-accent text-sm no-underline transition-colors">Cómo funciona</a></li>
              <li><a href="#interactive" className="text-muted hover:text-accent text-sm no-underline transition-colors">Demo en Vivo</a></li>
              <li><a href="#pricing" className="text-muted hover:text-accent text-sm no-underline transition-colors">Precios</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-text uppercase tracking-[0.04em] mb-6">Empresa</h4>
            <ul className="flex flex-col gap-4 list-none p-0">
              <li><a href="#" className="text-muted hover:text-accent text-sm no-underline transition-colors">Sobre nosotros</a></li>
              <li><a href="#" className="text-muted hover:text-accent text-sm no-underline transition-colors">Blog</a></li>
              <li><a href="#contact" className="text-muted hover:text-accent text-sm no-underline transition-colors">Contacto</a></li>
              <li><Link to="/terminos" className="text-muted hover:text-accent text-sm no-underline transition-colors">Términos y condiciones</Link></li>
              <li><Link to="/privacidad#datos" className="text-muted hover:text-accent text-sm no-underline transition-colors">Tratamiento de datos</Link></li>
              <li><Link to="/cookies" className="text-muted hover:text-accent text-sm no-underline transition-colors">Política de cookies</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-10 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-xs font-mono text-muted">
            © 2026 {branding.name} · Medellín, Colombia
          </div>
          <div className="text-xs text-muted flex gap-4 uppercase tracking-[0.04em]">
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
