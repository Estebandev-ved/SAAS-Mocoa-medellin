import { useEffect } from 'react';
import './legacy.css';

// Envuelve las rutas del panel admin y del portal: activa sus tokens de diseño mientras estén abiertas.
export default function LegacyScope({ children }) {
  useEffect(() => {
    document.documentElement.classList.add('legacy-scope');
    return () => document.documentElement.classList.remove('legacy-scope');
  }, []);
  return <div className="legacy-root">{children}</div>;
}
