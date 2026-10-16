import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Tema claro / oscuro / sistema. Se guarda en localStorage y se aplica con data-theme en <html>
// (las variables de color viven en index.css). El script de index.html lo aplica antes de pintar.
const ThemeContext = createContext({ theme: 'system', resolved: 'light', setTheme: () => {}, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

const KEY = 'noma-theme';
const leer = () => {
  try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; }
};
const sistemaOscuro = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(leer);
  const [oscuroSistema, setOscuroSistema] = useState(sistemaOscuro);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const fn = (e) => setOscuroSistema(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const resolved = theme === 'system' ? (oscuroSistema ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0A0A0A' : '#E53935');
  }, [resolved]);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    try { localStorage.setItem(KEY, t); } catch { /* sin almacenamiento: solo dura la sesión */ }
  }, []);
  const toggle = useCallback(() => setTheme(resolved === 'dark' ? 'light' : 'dark'), [resolved, setTheme]);

  return <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>{children}</ThemeContext.Provider>;
}
