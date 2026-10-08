import React, { createContext, useContext, useState, useEffect } from 'react';

const BrandingContext = createContext();

export const BrandingProvider = ({ children }) => {
  // Valores por defecto = design.md (tema claro, rojo de acción primary-strong)
  const [branding, setBranding] = useState({
    name: 'Antigravity',
    primary: '#C62828',
    accent: '#8E1B1B',
    theme: 'light',
    logo: '⚡',
  });

  // Apply colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', branding.primary);
    root.style.setProperty('--accent2', branding.accent);

    // Adjust accent-dim based on current primary
    const r = parseInt(branding.primary.slice(1, 3), 16);
    const g = parseInt(branding.primary.slice(3, 5), 16);
    const b = parseInt(branding.primary.slice(5, 7), 16);

    if (branding.theme === 'dark') {
      // Tema oscuro NOMA: black / ink / charcoal, borde rgba(255,255,255,0.08)
      root.style.setProperty('--bg', '#0A0A0A');
      root.style.setProperty('--bg2', '#111111');
      root.style.setProperty('--bg3', '#1A1A1A');
      root.style.setProperty('--text', '#F5F5F5');
      root.style.setProperty('--muted', '#A0A0A0');
      root.style.setProperty('--border', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--card', '#1A1A1A');
      root.style.setProperty('--glass', '#111111');
      root.style.setProperty('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.15)`);
    } else {
      // Tema claro NOMA: background white, surface gray-50, border #E4E4E4
      root.style.setProperty('--bg', '#FFFFFF');
      root.style.setProperty('--bg2', '#F8F8F8');
      root.style.setProperty('--bg3', '#F0F0F0');
      root.style.setProperty('--text', '#1A1A1A');
      root.style.setProperty('--muted', '#666666');
      root.style.setProperty('--border', '#E4E4E4');
      root.style.setProperty('--card', '#FFFFFF');
      root.style.setProperty('--glass', '#FFFFFF');
      root.style.setProperty('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.1)`);
    }
  }, [branding]);

  const updateBranding = (newBranding) => {
    setBranding(prev => ({ ...prev, ...newBranding }));
  };

  return (
    <BrandingContext.Provider value={{ branding, updateBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};
