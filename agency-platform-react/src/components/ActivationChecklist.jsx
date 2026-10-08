import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Package, CreditCard, Smartphone } from 'lucide-react';
import api from '../services/api';
import { Character } from './Illustration';

// Activación guiada: al registrarse solo se piden los datos mínimos; aquí se completa lo que el bot necesita,
// paso a paso. La prueba gratuita de 7 días empieza con la primera conexión de WhatsApp.
export default function ActivationChecklist({ user, onActivando }) {
  const navigate = useNavigate();
  const [estado, setEstado] = useState(null); // null = cargando

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [prod, perfil, wa] = await Promise.allSettled([
        api.get('/productos'),
        api.get('/business/perfil'),
        api.get('/whatsapp/status'),
      ]);
      if (!vivo) return;
      const productos = prod.status === 'fulfilled' ? (prod.value.data.productos || prod.value.data.data || []) : [];
      const negocio = perfil.status === 'fulfilled' ? (perfil.value.data.negocio || perfil.value.data) : {};
      const metodos = Array.isArray(negocio.metodos_pago_activos) ? negocio.metodos_pago_activos : [];
      setEstado({
        catalogo: productos.length > 0,
        pagos: metodos.length > 0,
        whatsapp: wa.status === 'fulfilled' && !!wa.value.data.conectado,
      });
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Avisa al panel si aún hay pasos pendientes (para no repetir a Nova en otras tarjetas)
  useEffect(() => {
    if (estado && onActivando) onActivando(!(estado.catalogo && estado.pagos && estado.whatsapp));
  }, [estado, onActivando]);

  if (!estado) return null;

  const pasos = [
    {
      id: 'catalogo',
      icon: Package,
      titulo: 'Carga tu catálogo',
      desc: 'Agrega al menos un producto o servicio para que el bot sepa qué vender.',
      hecho: estado.catalogo,
      cta: 'Ir a productos',
      to: '/productos',
    },
    {
      id: 'pagos',
      icon: CreditCard,
      titulo: 'Elige cómo cobras',
      desc: 'Nequi, Bancolombia, efectivo… el bot los ofrece al cerrar la venta.',
      hecho: estado.pagos,
      cta: 'Configurar pagos',
      to: '/ajustes?tab=pago',
    },
    {
      id: 'whatsapp',
      icon: Smartphone,
      titulo: 'Conecta tu WhatsApp',
      desc: 'Al conectarlo se enciende tu bot y empieza tu prueba gratis de 7 días.',
      hecho: estado.whatsapp,
      cta: 'Conectar WhatsApp',
      to: '/whatsapp',
    },
  ];

  const completados = pasos.filter((p) => p.hecho).length;
  if (completados === pasos.length) return null; // todo listo: el panel queda limpio

  const siguiente = pasos.find((p) => !p.hecho);
  const pct = Math.round((completados / pasos.length) * 100);
  const trialSinIniciar = !estado.whatsapp && !user?.trial_hasta;

  return (
    <section
      aria-label="Activa tu bot"
      className="bg-white border border-border rounded-2xl p-6 mb-8 flex flex-col md:flex-row gap-6 items-center md:items-stretch"
    >
      <div className="hidden md:flex items-end shrink-0 -mb-6 -ml-2">
        <Character name="nova" height={190} alt="Nova te guía para activar tu bot" />
      </div>

      <div className="flex-1 min-w-0 w-full">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
          <h2 className="font-head text-xl font-bold text-text">Activa tu bot</h2>
          <span className="text-sm font-semibold text-accent">{completados} de {pasos.length} listos</span>
        </div>
        <p className="text-sm text-muted mb-4">
          {trialSinIniciar
            ? 'Tu prueba gratis de 7 días empieza cuando conectes tu WhatsApp. Antes, deja todo listo:'
            : 'Completa estos pasos para que tu bot empiece a vender.'}
        </p>

        <div
          className="h-2 rounded-full bg-[#F0F0F0] overflow-hidden mb-5"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>

        <ul className="list-none p-0 m-0 space-y-2">
          {pasos.map((p) => {
            const Icon = p.icon;
            const esSiguiente = siguiente && siguiente.id === p.id;
            return (
              <li
                key={p.id}
                className={`flex items-center gap-4 p-3 rounded-xl border ${
                  esSiguiente ? 'border-accent/40 bg-[#FDECEA]' : 'border-border bg-white'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    p.hecho ? 'bg-success text-white' : 'bg-bg3 text-muted'
                  }`}
                >
                  {p.hecho ? <Check size={18} /> : <Icon size={18} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${p.hecho ? 'text-muted line-through' : 'text-text'}`}>{p.titulo}</p>
                  {!p.hecho && <p className="text-xs text-muted leading-5">{p.desc}</p>}
                </div>
                {esSiguiente && (
                  <button
                    onClick={() => navigate(p.to)}
                    className="h-11 sm:h-10 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold inline-flex items-center gap-2 border-none cursor-pointer transition-colors shrink-0"
                  >
                    {p.cta} <ArrowRight size={16} />
                  </button>
                )}
                {!p.hecho && !esSiguiente && (
                  <button
                    onClick={() => navigate(p.to)}
                    className="h-11 sm:h-10 px-4 rounded-xl bg-white hover:bg-bg2 text-text text-sm font-semibold border border-[#C9C9C9] cursor-pointer transition-colors shrink-0"
                  >
                    {p.cta}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
