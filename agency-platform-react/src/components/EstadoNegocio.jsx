import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import api from '../services/api';
import { Character } from './Illustration';

const TRIAL_TOTAL = 7;

// Franja de estado del panel, contada por los personajes:
//  - Nova (el bot): despierta si WhatsApp está conectado, dormida si no; con los días que quedan de prueba.
//  - Sofía: solo aparece si hay comprobantes de pago esperando tu revisión.
export default function EstadoNegocio({ plan, activando = false, domicilios = false }) {
  const navigate = useNavigate();
  const [conectado, setConectado] = useState(null); // null = cargando
  const [porRevisar, setPorRevisar] = useState(0);
  const [incidentes, setIncidentes] = useState(0); // entregas retrasadas o en disputa
  const [sinRepartidor, setSinRepartidor] = useState(0); // domicilios esperando domiciliario

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [wa, ped] = await Promise.allSettled([
        api.get('/whatsapp/status'),
        api.get('/pedidos', { params: { estado: 'pago_enviado', limit: 50 } }),
      ]);
      if (!vivo) return;
      setConectado(wa.status === 'fulfilled' ? !!wa.value.data.conectado : false);
      if (ped.status === 'fulfilled') setPorRevisar((ped.value.data.pedidos || []).length);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // Mateo: solo si el plan incluye Domicilios (si no, la API responde con error y se ignora)
  useEffect(() => {
    if (!domicilios) return undefined;
    let vivo = true;
    (async () => {
      const [inc, act] = await Promise.allSettled([api.get('/domicilios/incidentes'), api.get('/domicilios/active')]);
      if (!vivo) return;
      setIncidentes(inc.status === 'fulfilled' ? (inc.value.data.data || []).length : 0);
      setSinRepartidor(act.status === 'fulfilled' ? (act.value.data.data?.pendientes || []).length : 0);
    })();
    return () => {
      vivo = false;
    };
  }, [domicilios]);

  if (conectado === null) return null;

  // Mientras el checklist pide conectar WhatsApp, él ya cuenta esa historia: no se repite a Nova dormida
  const mostrarNova = !(activando && !conectado);
  const hayMateo = domicilios && (incidentes > 0 || sinRepartidor > 0);
  if (!mostrarNova && porRevisar === 0 && !hayMateo) return null;
  const tarjetas = (mostrarNova ? 1 : 0) + (porRevisar > 0 ? 1 : 0) + (hayMateo ? 1 : 0);

  const enTrial = !!plan?.en_trial;
  const dias = plan?.dias_trial_restantes ?? 0;
  const pctTrial = Math.min(100, Math.round(((TRIAL_TOTAL - dias) / TRIAL_TOTAL) * 100));
  const trialPorVencer = enTrial && dias <= 2;

  return (
    <section
      aria-label="Estado de tu negocio"
      className={`grid gap-4 mb-8 ${tarjetas > 1 ? 'lg:grid-cols-2' : ''}`}
    >
      {/* Nova: el bot */}
      {mostrarNova && (
      <div className="bg-white border border-border rounded-2xl p-5 flex items-center gap-5">
        <div className="relative shrink-0">
          <div className={conectado ? '' : 'noma-dormido'}>
            <Character
              name="nova"
              height={104}
              alt={conectado ? 'Nova, tu bot, está despierto' : 'Nova, tu bot, está dormido'}
            />
          </div>
          {!conectado && (
            <span aria-hidden="true" className="absolute -top-1 right-0 flex flex-col items-start font-head font-bold text-muted leading-none select-none">
              <span className="noma-zzz text-lg" style={{ animationDelay: '0s' }}>Z</span>
              <span className="noma-zzz text-sm" style={{ animationDelay: '0.6s' }}>z</span>
              <span className="noma-zzz text-xs" style={{ animationDelay: '1.2s' }}>z</span>
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${conectado ? 'bg-success' : 'bg-[#A0A0A0]'}`}
              aria-hidden="true"
            />
            <h2 className="font-head text-lg font-bold text-text">
              {conectado ? 'Tu bot está en línea' : 'Tu bot está dormido'}
            </h2>
          </div>

          {!conectado && (
            <>
              <p className="text-sm text-muted leading-5 mb-3">
                Conecta tu WhatsApp para despertarlo y que empiece a atender a tus clientes.
              </p>
              <button
                onClick={() => navigate('/whatsapp')}
                className="h-10 px-4 rounded-xl bg-white hover:bg-bg2 text-text text-sm font-semibold border border-[#C9C9C9] cursor-pointer transition-colors inline-flex items-center gap-2"
              >
                Conectar WhatsApp <ArrowRight size={16} />
              </button>
            </>
          )}

          {conectado && !enTrial && (
            <p className="text-sm text-muted leading-5">Atendiendo a tus clientes en WhatsApp las 24 horas.</p>
          )}

          {conectado && enTrial && (
            <>
              <p className="text-sm text-muted leading-5 mb-3">
                {dias <= 0
                  ? 'Hoy termina tu prueba gratis.'
                  : `Te ${dias === 1 ? 'queda 1 día' : `quedan ${dias} días`} de prueba gratis.`}
              </p>
              <div
                className="h-2 rounded-full bg-[#F0F0F0] overflow-hidden mb-3"
                role="progressbar"
                aria-label="Días de prueba usados"
                aria-valuenow={pctTrial}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full bg-accent rounded-full" style={{ width: `${pctTrial}%` }} />
              </div>
              <button
                onClick={() => navigate('/suscripcion')}
                className={
                  trialPorVencer
                    ? 'h-10 px-4 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold border-none cursor-pointer transition-colors inline-flex items-center gap-2'
                    : 'h-10 px-4 rounded-xl bg-white hover:bg-bg2 text-text text-sm font-semibold border border-[#C9C9C9] cursor-pointer transition-colors inline-flex items-center gap-2'
                }
              >
                Ver planes <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
      </div>
      )}

      {/* Sofía: pagos por revisar */}
      {porRevisar > 0 && (
        <div className="bg-white border border-warn/40 rounded-2xl p-5 flex items-center gap-5">
          <div className="shrink-0 noma-cheer">
            <Character name="sofia" height={104} alt="Sofía te avisa de pagos por revisar" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-head text-lg font-bold text-text mb-1">
              {porRevisar === 1 ? '1 comprobante por revisar' : `${porRevisar} comprobantes por revisar`}
            </h2>
            <p className="text-sm text-muted leading-5 mb-3">
              Tus clientes ya enviaron el pago. Confírmalo para que el pedido siga su camino.
            </p>
            <button
              onClick={() => navigate('/pedidos')}
              className="h-10 px-4 rounded-xl bg-white hover:bg-bg2 text-text text-sm font-semibold border border-[#C9C9C9] cursor-pointer transition-colors inline-flex items-center gap-2"
            >
              Revisar pedidos <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Mateo: domicilios con problemas o sin repartidor */}
      {hayMateo && (
        <div className={`bg-white border rounded-2xl p-5 flex items-center gap-5 ${incidentes > 0 ? 'border-danger/50' : 'border-warn/40'}`}>
          <div className="shrink-0">
            <Character name="mateo" height={104} alt="Mateo te avisa de tus domicilios" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-head text-lg font-bold text-text mb-1">
              {incidentes > 0
                ? incidentes === 1 ? '1 entrega con problemas' : `${incidentes} entregas con problemas`
                : sinRepartidor === 1 ? '1 domicilio esperando repartidor' : `${sinRepartidor} domicilios esperando repartidor`}
            </h2>
            <p className="text-sm text-muted leading-5 mb-3">
              {incidentes > 0
                ? 'Hay domicilios retrasados o en disputa. Revísalos para resolverlos con el cliente.'
                : 'Asígnalos a un domiciliario para que salgan a tiempo.'}
            </p>
            <button
              onClick={() => navigate('/domicilios')}
              className="h-10 px-4 rounded-xl bg-white hover:bg-bg2 text-text text-sm font-semibold border border-[#C9C9C9] cursor-pointer transition-colors inline-flex items-center gap-2"
            >
              Ir a domicilios <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
