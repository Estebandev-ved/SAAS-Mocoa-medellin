import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { Character } from './Illustration';

// Aviso global de conexión. Sin internet los pedidos nuevos no llegan (el panel no guarda datos
// de la API a propósito, ver public/sw.js), así que se dice claro; al volver, confirma y se va.
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [volvio, setVolvio] = useState(false);

  useEffect(() => {
    let t;
    const off = () => { setOnline(false); setVolvio(false); };
    const on = () => { setOnline(true); setVolvio(true); t = setTimeout(() => setVolvio(false), 3000); };
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on); clearTimeout(t); };
  }, []);

  return (
    <AnimatePresence>
      {(!online || volvio) && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ y: -80 }}
          animate={{ y: 0 }}
          exit={{ y: -80 }}
          className={`fixed top-0 inset-x-0 z-[120] pt-safe ${online ? 'bg-success' : 'bg-inverse'} text-white`}
        >
          <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
            {online ? <Wifi size={18} /> : (
              <span className="w-9 h-9 rounded-lg bg-accent-dim overflow-hidden flex items-end justify-center shrink-0"><Character name="nova" height={34} alt="" /></span>
            )}
            <p className="m-0 leading-5">
              {online
                ? 'Volvió la conexión.'
                : <><WifiOff size={14} className="inline -mt-0.5 mr-1" /><strong>Sin conexión.</strong> Los pedidos y mensajes nuevos no se verán hasta que vuelva el internet.</>}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
