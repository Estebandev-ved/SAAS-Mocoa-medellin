import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNegocio } from '../../hooks/useNegocio';
import { gruposParaNegocio, seccionDe, pestanasDe, pestanaActiva, estaBloqueado, textoBloqueo } from './navConfig';

// Cada sección del menú (Ventas, Productos, Marketing, Reportes, Ajustes) agrupa varias pantallas: aquí se dibujan
// como pestañas arriba del contenido. Las secciones de una sola pantalla (Inicio, Mensajes, Clientes) no muestran nada.
// Las rutas siguen siendo las de siempre, así que los enlaces y favoritos viejos funcionan.
export default function SeccionLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { puede } = useNegocio();
  const conCocina = puede('cocina');
  const grupos = useMemo(() => gruposParaNegocio({ conCocina }), [conCocina]);
  const seccion = seccionDe(grupos, pathname);
  const tabs = seccion ? pestanasDe(seccion) : [];
  const plan = user?.plan || 'starter';

  return (
    <>
      {tabs.length > 1 && (
        <nav aria-label={`Secciones de ${seccion.label}`} className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-border">
          <ul className="flex gap-1 overflow-x-auto px-3 md:px-6 m-0 list-none [scrollbar-width:none]" role="tablist">
            {tabs.map((t) => {
              const activa = pestanaActiva(t, pathname);
              const bloqueada = estaBloqueado(t, plan);
              const Icono = t.icon;
              return (
                <li key={t.path} role="presentation" className="shrink-0">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activa}
                    aria-disabled={bloqueada || undefined}
                    title={bloqueada ? textoBloqueo(t) : undefined}
                    onClick={() => { if (!bloqueada && !activa) navigate(t.path); }}
                    className={`min-h-[44px] px-3 md:px-4 inline-flex items-center gap-2 text-sm font-semibold whitespace-nowrap bg-transparent border-0 border-b-2 -mb-px transition-colors ${
                      activa ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'
                    } ${bloqueada ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <Icono size={16} className={activa ? 'text-accent' : ''} aria-hidden="true" />
                    {t.label}
                    {bloqueada && <Lock size={12} aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      <Outlet />
    </>
  );
}
