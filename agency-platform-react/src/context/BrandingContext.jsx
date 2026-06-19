import React, { createContext, useContext, useState, useEffect } from 'react';

const BrandingContext = createContext();

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState({
    name: 'Antigravity',
    primary: '#00FFD1',
    accent: '#00C4A0',
    theme: 'dark',
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
    root.style.setProperty('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.12)`);
    root.style.setProperty('--border', `rgba(${r}, ${g}, ${b}, 0.15)`);

    if (branding.theme === 'light') {
      root.style.setProperty('--bg', '#F5F5F0');
      root.style.setProperty('--bg2', '#FFFFFF');
      root.style.setProperty('--bg3', '#EAEA E5');
      root.style.setProperty('--text', '#111111');
      root.style.setProperty('--muted', '#666666');
    } else {
      root.style.setProperty('--bg', '#080C10');
      root.style.setProperty('--bg2', '#0D1117');
      root.style.setProperty('--bg3', '#131820');
      root.style.setProperty('--text', '#E8F0F7');
      root.style.setProperty('--muted', '#5A7080');
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
