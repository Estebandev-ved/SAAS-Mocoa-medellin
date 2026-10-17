import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomSheet from '../BottomSheet';

// Atajos tipo "g + letra" (como en Gmail/GitHub): se pulsa g y luego la letra, sin modificadores.
// "?" abre la lista. Se ignoran dentro de campos de texto.
export const IR_A = [
  { tecla: 'd', label: 'Dashboard', path: '/dashboard' },
  { tecla: 'p', label: 'Pedidos', path: '/pedidos' },
  { tecla: 'c', label: 'Conversaciones', path: '/conversaciones' },
  { tecla: 'o', label: 'Productos', path: '/productos' },
  { tecla: 'l', label: 'Clientes', path: '/clientes' },
  { tecla: 'a', label: 'Automatizaciones', path: '/automatizaciones' },
  { tecla: 'm', label: 'Campañas', path: '/campanas' },
  { tecla: 'n', label: 'Analytics', path: '/analytics' },
  { tecla: 's', label: 'Ajustes', path: '/ajustes' },
];

const enCampo = (t) => t?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName);

export default function AtajosTeclado({ extra = [] }) {
  const navigate = useNavigate();
  const [ayuda, setAyuda] = useState(false);
  const esperandoG = useRef(false);
  const timer = useRef(null);
  const destinos = [...IR_A, ...extra];

  useEffect(() => {
    const onKey = (e) => {
      if (enCampo(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '?') { setAyuda((a) => !a); return; }
      if (esperandoG.current) {
        esperandoG.current = false;
        clearTimeout(timer.current);
        const d = destinos.find((x) => x.tecla === e.key.toLowerCase());
        if (d) { e.preventDefault(); navigate(d.path); }
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        esperandoG.current = true;
        timer.current = setTimeout(() => { esperandoG.current = false; }, 1200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, extra.length]);

  const Tecla = ({ children }) => <kbd className="font-mono text-xs border border-border rounded px-1.5 py-0.5 bg-bg2">{children}</kbd>;

  return (
    <BottomSheet abierto={ayuda} onCerrar={() => setAyuda(false)} titulo="Atajos de teclado" z={96}>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-text mb-4">
        {destinos.map((d) => (
          <div key={d.tecla} className="flex items-center justify-between py-1.5">
            <span>{d.label}</span>
            <span className="flex items-center gap-1"><Tecla>g</Tecla> <Tecla>{d.tecla}</Tecla></span>
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-3 space-y-1.5 text-sm text-text">
        <div className="flex items-center justify-between"><span>Buscar en todo el panel</span><Tecla>Ctrl K</Tecla></div>
        <div className="flex items-center justify-between"><span>En Pedidos: buscar / recargar</span><span className="flex gap-1"><Tecla>/</Tecla><Tecla>r</Tecla></span></div>
        <div className="flex items-center justify-between"><span>Ver esta ayuda</span><Tecla>?</Tecla></div>
      </div>
    </BottomSheet>
  );
}
