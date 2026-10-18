import { useEffect, useState } from 'react';
import { leerPreferencias } from '../utils/preferencias';

// Devuelve las preferencias de la cuenta y se vuelve a renderizar cuando cambian
// (al sincronizar con el servidor o al guardarlas en Ajustes).
export default function usePreferencias() {
  const [prefs, setPrefs] = useState(leerPreferencias);
  useEffect(() => {
    const alCambiar = () => setPrefs(leerPreferencias());
    window.addEventListener('preferencias-actualizadas', alCambiar);
    return () => window.removeEventListener('preferencias-actualizadas', alCambiar);
  }, []);
  return prefs;
}
