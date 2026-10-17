import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, LogOut, Moon, MoreHorizontal, Search, Sun, X, Crown, Star, Shield, Store, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { usePedidosLive } from '../../context/PedidosLiveContext';
import api from '../../services/api';
import Logo from '../Logo';
import CommandPalette from './CommandPalette';
import AtajosTeclado from './AtajosTeclado';
import BannersGlobales from '../BannersGlobales';
import { useNegocio } from '../../hooks/useNegocio';
import { GRUPOS, ITEM_ADMIN, ITEM_COCINA, BARRA_INFERIOR, estaBloqueado, textoBloqueo, planLabel } from './navConfig';

const PlanIcon = ({ plan, size = 16 }) => {
  const c = 'text-[#E53935]';
  if (plan === 'enterprise') return <Crown size={size} className={c} />;
  if (plan === 'professional') return <Star size={size} className={c} />;
  if (plan === 'emprendedor') return <Store size={size} className={c} />;
  return <Shield size={size} className="text-[#A0A0A0]" />;
};

function NavLink({ item, activo, bloqueado, badge, onIr }) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => !bloqueado && onIr(item.path)}
      aria-current={activo ? 'page' : undefined}
      aria-disabled={bloqueado || undefined}
      title={bloqueado ? textoBloqueo(item) : undefined}
      className={`relative w-full flex items-center gap-3 px-4 h-10 rounded-xl text-sm font-semibold transition-colors duration-200 border-none ${
        activo ? 'bg-white/10 text-inverse-text' : 'bg-transparent text-[#A0A0A0] hover:bg-white/5 hover:text-inverse-text'
      } ${bloqueado ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {activo && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#E53935] rounded-r" />}
      <Icon size={18} className={activo ? 'text-[#E53935]' : ''} />
      <span>{item.label}</span>
      {bloqueado && <Lock size={13} className="ml-auto" />}
      {!bloqueado && badge > 0 && (
        <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-[#E53935] text-white text-[11px] font-bold flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function MenuGrupos({ grupos, pathname, plan, pendientes, onIr, cerrados, alternar }) {
  return (
    <nav aria-label="Principal" className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {grupos.map((g) => {
        const cerrado = cerrados.includes(g.id) && !g.items.some((i) => i.path === pathname);
        return (
          <div key={g.id}>
            <button
              onClick={() => alternar(g.id)}
              aria-expanded={!cerrado}
              className="w-full flex items-center justify-between px-2 h-7 bg-transparent border-none cursor-pointer text-[11px] font-semibold tracking-[0.08em] uppercase text-[#8A8A8A] hover:text-inverse-text"
            >
              {g.label}
              <ChevronDown size={14} className={`transition-transform ${cerrado ? '-rotate-90' : ''}`} />
            </button>
            {!cerrado && (
              <div className="space-y-0.5 mt-1">
                {g.items.map((item) => (
                  <NavLink
                    key={item.path}
                    item={item}
                    activo={pathname === item.path}
                    bloqueado={estaBloqueado(item, plan)}
                    badge={item.badge === 'pedidos' ? pendientes : 0}
                    onIr={onIr}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// Layout compartido de todo el panel del dueño: menú lateral agrupado (escritorio), barra superior +
// barra inferior + cajón (celular), paleta Ctrl+K, tema claro/oscuro y transición entre pantallas.
export default function AppShell() {
  const { user, logout, loading, isAuthenticated } = useAuth();
  const { resolved, toggle } = useTheme();
  const { eventos } = usePedidosLive();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const reducir = useReducedMotion();

  const [planApi, setPlanApi] = useState(null);
  const [pendientes, setPendientes] = useState(0);
  const [cajon, setCajon] = useState(false);
  const [paleta, setPaleta] = useState(false);
  const [cerrados, setCerrados] = useState(() => {
    try { return JSON.parse(localStorage.getItem('noma-nav-cerrados') || '[]'); } catch { return []; }
  });

  const plan = planApi || user?.plan || 'starter';
  const { puede } = useNegocio();
  const conCocina = puede('cocina');
  const grupos = useMemo(() => {
    let g = GRUPOS;
    // Herramientas por tipo de negocio (utils/capacidades.js): el modo cocina va justo debajo de Pedidos
    if (conCocina) {
      g = g.map((gr, i) => (i === 0 ? { ...gr, items: [gr.items[0], gr.items[1], ITEM_COCINA, ...gr.items.slice(2)] } : gr));
    }
    if (user?.rol === 'admin' || user?.rol === 'superadmin') {
      g = [...g.slice(0, -1), { ...g[g.length - 1], items: [...g[g.length - 1].items, ITEM_ADMIN] }];
    }
    return g;
  }, [user?.rol, conCocina]);
  const todos = useMemo(() => grupos.flatMap((g) => g.items.map((i) => ({ ...i, grupo: g.label, bloqueado: estaBloqueado(i, plan) }))), [grupos, plan]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/business/plan').then((r) => r.data?.plan?.tipo && setPlanApi(r.data.plan.tipo)).catch(() => {});
  }, [isAuthenticated]);

  // Contador de pedidos por atender (pago enviado/confirmado): se refresca al navegar y con cada aviso en vivo
  useEffect(() => {
    if (!isAuthenticated) return;
    api.get('/pedidos')
      .then((r) => {
        const lista = r.data?.pedidos || r.data?.data || [];
        setPendientes(lista.filter((p) => p.estado === 'pago_enviado' || p.estado === 'pago_confirmado').length);
      })
      .catch(() => {});
  }, [isAuthenticated, eventos, pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaleta((a) => !a);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ir = useCallback((path) => { setCajon(false); navigate(path); }, [navigate]);
  const alternar = useCallback((id) => {
    setCerrados((prev) => {
      const sig = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem('noma-nav-cerrados', JSON.stringify(sig)); } catch { /* opcional */ }
      return sig;
    });
  }, []);

  const accionesExtra = useMemo(
    () => [{ icon: resolved === 'dark' ? Sun : Moon, label: resolved === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro', grupo: 'Apariencia', accion: toggle }],
    [resolved, toggle]
  );

  if (!loading && !isAuthenticated) return <Navigate to="/login" replace />;

  const barra = BARRA_INFERIOR.map((p) => todos.find((i) => i.path === p)).filter(Boolean);
  const tituloActual = todos.find((i) => i.path === pathname)?.label || '';

  return (
    <div className="min-h-screen bg-bg2 lg:flex">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-accent focus:text-white focus:px-4 focus:py-2 focus:rounded-lg">
        Saltar al contenido
      </a>

      {/* Escritorio: menú lateral fijo */}
      <aside data-tour="menu" className="w-72 shrink-0 bg-inverse text-inverse-text border-r border-white/10 hidden lg:flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-white/10">
          <Logo size={36} tone="light" />
        </div>

        <button
          onClick={() => ir('/suscripcion')}
          className="mx-4 mt-4 px-4 h-12 rounded-xl bg-white/10 flex items-center gap-3 border-none cursor-pointer text-left"
        >
          <PlanIcon plan={plan} />
          <span className="text-sm text-inverse-text font-medium">{planLabel(plan)}</span>
          <span className="ml-auto text-xs font-semibold text-[#E53935]">{plan === 'enterprise' ? 'CAMBIAR' : 'MEJORAR'}</span>
        </button>

        <button
          data-tour="buscar"
          onClick={() => setPaleta(true)}
          className="mx-4 mt-3 px-3 h-9 rounded-xl bg-transparent border border-white/15 text-[#A0A0A0] hover:text-inverse-text hover:border-white/30 flex items-center gap-2 text-xs cursor-pointer"
        >
          <Search size={14} /> Buscar…
          <kbd className="ml-auto font-mono text-[10px] border border-white/20 rounded px-1.5 py-0.5">Ctrl K</kbd>
        </button>

        <MenuGrupos grupos={grupos} pathname={pathname} plan={plan} pendientes={pendientes} onIr={ir} cerrados={cerrados} alternar={alternar} />

        <div className="p-4 border-t border-white/10 space-y-0.5">
          <button
            onClick={toggle}
            className="w-full flex items-center gap-3 px-4 h-10 rounded-xl text-sm font-semibold text-[#A0A0A0] bg-transparent border-none hover:bg-white/5 hover:text-inverse-text cursor-pointer"
          >
            {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{resolved === 'dark' ? 'Tema claro' : 'Tema oscuro'}</span>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 h-10 rounded-xl text-sm font-semibold text-[#A0A0A0] bg-transparent border-none hover:bg-white/5 hover:text-inverse-text cursor-pointer"
          >
            <LogOut size={18} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Celular: barra superior */}
        <header className="lg:hidden sticky top-0 z-40 bg-inverse text-inverse-text pt-safe">
          <div className="h-14 px-4 flex items-center gap-3">
            <Logo size={28} tone="light" showName={false} />
            <span className="font-head font-bold text-sm truncate">{tituloActual || 'Antigravity'}</span>
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => setPaleta(true)} aria-label="Buscar" className="w-11 h-11 flex items-center justify-center bg-transparent border-none text-inverse-text cursor-pointer">
                <Search size={20} />
              </button>
              <button onClick={toggle} aria-label="Cambiar tema" className="w-11 h-11 flex items-center justify-center bg-transparent border-none text-inverse-text cursor-pointer">
                {resolved === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>
        </header>

        <BannersGlobales />

        <main id="contenido" className="flex-1 pb-24 lg:pb-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={reducir ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducir ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Celular: barra inferior */}
      <nav aria-label="Atajos" data-tour="menu-movil" className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-inverse border-t border-white/10 pb-safe">
        <ul className="grid grid-cols-5 m-0 p-0 list-none">
          {barra.map((item) => {
            const Icon = item.icon;
            const activo = pathname === item.path;
            return (
              <li key={item.path}>
                <button
                  onClick={() => !item.bloqueado && ir(item.path)}
                  aria-current={activo ? 'page' : undefined}
                  className={`relative w-full h-16 flex flex-col items-center justify-center gap-1 bg-transparent border-none cursor-pointer text-[11px] font-semibold ${
                    activo ? 'text-inverse-text' : 'text-[#A0A0A0]'
                  } ${item.bloqueado ? 'opacity-40' : ''}`}
                >
                  <span className="relative">
                    <Icon size={22} className={activo ? 'text-[#E53935]' : ''} />
                    {item.badge === 'pedidos' && pendientes > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-[#E53935] text-white text-[10px] font-bold flex items-center justify-center">
                        {pendientes > 9 ? '9+' : pendientes}
                      </span>
                    )}
                  </span>
                  {item.label}
                </button>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => setCajon(true)}
              className="w-full h-16 flex flex-col items-center justify-center gap-1 bg-transparent border-none cursor-pointer text-[11px] font-semibold text-[#A0A0A0]"
            >
              <MoreHorizontal size={22} />
              Más
            </button>
          </li>
        </ul>
      </nav>

      {/* Celular: cajón "Más" con todo el menú */}
      <AnimatePresence>
        {cajon && (
          <motion.div className="lg:hidden fixed inset-0 z-[80]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setCajon(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menú"
              initial={reducir ? false : { y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="absolute bottom-0 inset-x-0 max-h-[85vh] bg-inverse text-inverse-text rounded-t-3xl flex flex-col pb-safe"
            >
              <div className="flex items-center justify-between px-5 h-14 border-b border-white/10">
                <span className="font-head font-bold">Menú</span>
                <button onClick={() => setCajon(false)} aria-label="Cerrar menú" className="w-11 h-11 flex items-center justify-center bg-transparent border-none text-inverse-text cursor-pointer">
                  <X size={22} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                <MenuGrupos grupos={grupos} pathname={pathname} plan={plan} pendientes={pendientes} onIr={ir} cerrados={[]} alternar={() => {}} />
                <div className="px-4 pb-4">
                  <button onClick={logout} className="w-full flex items-center gap-3 px-4 h-11 rounded-xl text-sm font-semibold text-[#A0A0A0] bg-transparent border-none cursor-pointer">
                    <LogOut size={18} /> Cerrar sesión
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AtajosTeclado extra={conCocina ? [{ tecla: 'k', label: 'Modo cocina', path: '/cocina' }] : []} />
      <CommandPalette abierto={paleta} onCerrar={() => setPaleta(false)} items={todos} accionesExtra={accionesExtra} onIr={ir} />
    </div>
  );
}
