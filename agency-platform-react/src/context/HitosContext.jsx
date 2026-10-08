import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuth } from './AuthContext';
import { HITOS } from './hitosConfig';
import { businessService } from '../services/api';
import { Character } from '../components/Illustration';
import CheckBadge from '../components/CheckBadge';

// Estado de "ya visto" de los personajes: logros celebrados (ids de HITOS) y consejos de Nova ("tip:<id>").
// Se guarda en el servidor (PUT /business/ui-estado) para que no se repitan al cambiar de navegador,
// con una copia en localStorage para responder al instante y como respaldo si el servidor no responde.
const HitosContext = createContext({
  celebrar: () => false,
  cargado: false,
  haVisto: () => true,
  marcarVisto: () => {},
});

const claveStorage = (user) => `noma_vistos_${user?.id ?? user?.email ?? 'anon'}`;

function leerLocal(user) {
  try {
    const lista = JSON.parse(localStorage.getItem(claveStorage(user)) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function guardarLocal(user, lista) {
  try {
    localStorage.setItem(claveStorage(user), JSON.stringify(lista));
  } catch {
    /* sin almacenamiento: solo se pierde la copia local */
  }
}

export function HitosProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.id ?? user?.email ?? null;

  const [cola, setCola] = useState([]);
  const [vistos, setVistos] = useState([]);
  const [cargado, setCargado] = useState(false);

  // Las páginas llaman desde closures viejas: todo se lee de refs para que las funciones sean estables.
  const userRef = useRef(user);
  userRef.current = user;
  const vistosRef = useRef([]);
  const cargadoRef = useRef(false);
  const pendientesRef = useRef([]); // logros pedidos mientras aún se cargaba el estado del servidor

  const marcarVisto = useCallback((id) => {
    if (vistosRef.current.includes(id)) return;
    const lista = [...vistosRef.current, id];
    vistosRef.current = lista;
    setVistos(lista);
    guardarLocal(userRef.current, lista);
    if (cargadoRef.current) businessService.saveUiEstado([id]).catch(() => {});
  }, []);

  // Cada logro se celebra una sola vez por cuenta; devuelve true si se encoló.
  const celebrar = useCallback(
    (id) => {
      if (!userRef.current || !HITOS[id]) return false;
      if (!cargadoRef.current) {
        if (!pendientesRef.current.includes(id)) pendientesRef.current.push(id);
        return true;
      }
      if (vistosRef.current.includes(id)) return false;
      marcarVisto(id);
      setCola((prev) => (prev.includes(id) ? prev : [...prev, id]));
      return true;
    },
    [marcarVisto]
  );
  const celebrarRef = useRef(celebrar);
  celebrarRef.current = celebrar;

  useEffect(() => {
    cargadoRef.current = false;
    setCargado(false);
    if (!uid) {
      vistosRef.current = [];
      setVistos([]);
      return undefined;
    }
    let vivo = true;
    const local = leerLocal(userRef.current);
    vistosRef.current = local;
    setVistos(local);

    (async () => {
      let delServidor = [];
      try {
        const r = await businessService.getUiEstado();
        delServidor = Array.isArray(r.vistos) ? r.vistos : [];
      } catch {
        /* servidor sin la ruta o sin conexión: se sigue con la copia local */
      }
      if (!vivo) return;
      const union = [...new Set([...delServidor, ...vistosRef.current])];
      vistosRef.current = union;
      setVistos(union);
      guardarLocal(userRef.current, union);
      // Lo que solo existía en este navegador se sube para que valga en los demás
      if (union.length > delServidor.length) businessService.saveUiEstado(union).catch(() => {});
      cargadoRef.current = true;
      setCargado(true);
      const pendientes = pendientesRef.current;
      pendientesRef.current = [];
      pendientes.forEach((id) => celebrarRef.current(id));
    })();

    return () => {
      vivo = false;
    };
  }, [uid]);

  const cerrar = useCallback(() => setCola((prev) => prev.slice(1)), []);
  const haVisto = useCallback((id) => vistos.includes(id), [vistos]);
  const value = useMemo(
    () => ({ celebrar, cargado, haVisto, marcarVisto }),
    [celebrar, cargado, haVisto, marcarVisto]
  );

  return (
    <HitosContext.Provider value={value}>
      {children}
      {cola.length > 0 && <HitoCard key={cola[0]} id={cola[0]} onClose={cerrar} />}
    </HitosContext.Provider>
  );
}

export const useHitos = () => useContext(HitosContext);

function HitoCard({ id, onClose }) {
  const hito = HITOS[id];
  const navigate = useNavigate();
  const reducir = useReducedMotion();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ir = () => {
    onClose();
    navigate(hito.accion.to);
  };

  return (
    <motion.div
      role="status"
      aria-labelledby={`hito-${id}`}
      initial={reducir ? false : { opacity: 0, y: 32, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="fixed bottom-6 right-6 z-[60] w-[min(460px,calc(100vw-32px))] bg-white border border-border rounded-3xl shadow-[0_12px_32px_rgba(10,10,10,0.16)] p-4 pr-6 flex gap-5 items-stretch"
    >
      <div className="relative shrink-0 w-[112px] rounded-2xl bg-[#FDECEA] flex items-end justify-center overflow-visible">
        <div className="noma-hop -mt-6">
          <div className="noma-breathe">
            <Character name={hito.personaje} height={160} alt="" />
          </div>
        </div>
        <CheckBadge size={32} className="absolute -top-2 -right-2" />
      </div>

      <div className="min-w-0 flex-1 py-2">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 w-11 h-11 sm:w-8 sm:h-8 rounded-lg bg-transparent border-none text-muted hover:bg-bg2 cursor-pointer flex items-center justify-center"
        >
          <X size={16} />
        </button>
        <p className="text-xs font-semibold tracking-[0.04em] uppercase text-accent mb-1">Logro desbloqueado</p>
        <h2 id={`hito-${id}`} className="font-head text-lg font-bold text-text leading-6 mb-1 pr-6">
          {hito.titulo}
        </h2>
        <p className="text-sm text-muted leading-5 mb-4">{hito.mensaje}</p>
        <div className="flex flex-wrap gap-2">
          {hito.accion && (
            <button
              onClick={ir}
              className="h-11 sm:h-10 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold border-none cursor-pointer transition-colors"
            >
              {hito.accion.label}
            </button>
          )}
          <button
            onClick={onClose}
            className="h-11 sm:h-10 px-4 rounded-xl bg-white hover:bg-bg2 text-text text-sm font-semibold border border-[#C9C9C9] cursor-pointer transition-colors"
          >
            {hito.accion ? 'Más tarde' : 'Entendido'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
