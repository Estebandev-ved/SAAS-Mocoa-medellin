import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import api from '../services/api';
import { Skeleton } from './Skeleton';

const PAGADOS = ['pago_confirmado', 'confirmado', 'en_preparacion', 'enviado', 'entregado'];
const RANGOS = [{ d: 7, l: '7 días' }, { d: 14, l: '14 días' }, { d: 30, l: '30 días' }, { d: 90, l: '90 días' }];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const cop = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const corto = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`);
const clave = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function TooltipVentas({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-text m-0 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="m-0 flex items-center gap-2" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <strong>{p.dataKey === 'pedidos' ? p.value : cop(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

// Ventas con filtro de fechas, comparación con el período anterior y los momentos que más venden.
// Se calcula en el navegador a partir de los pedidos pagados (sin endpoint nuevo).
export default function VentasInteractivas() {
  const [pedidos, setPedidos] = useState(null);
  const [dias, setDias] = useState(14);
  const [comparar, setComparar] = useState(true);

  useEffect(() => {
    let vivo = true;
    api.get('/pedidos').then((r) => vivo && setPedidos(r.data?.pedidos || [])).catch(() => vivo && setPedidos([]));
    return () => { vivo = false; };
  }, []);

  const datos = useMemo(() => {
    const pagados = (pedidos || []).filter((p) => PAGADOS.includes(p.estado) && p.created_at);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const serie = [];
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(d.getDate() - i);
      const anterior = new Date(d); anterior.setDate(anterior.getDate() - dias);
      serie.push({ k: clave(d), ka: clave(anterior), dia: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }), ventas: 0, anterior: 0, pedidos: 0 });
    }
    const idx = Object.fromEntries(serie.map((s, i) => [s.k, i]));
    const idxAnt = Object.fromEntries(serie.map((s, i) => [s.ka, i]));
    const horas = Array.from({ length: 24 }, (_, h) => ({ h, etiqueta: `${h}h`, ventas: 0 }));
    const semana = DIAS.map((d) => ({ d, ventas: 0 }));
    let total = 0, totalAnt = 0, cuenta = 0;
    pagados.forEach((p) => {
      const f = new Date(p.created_at);
      const v = parseFloat(p.total) || 0;
      const k = clave(f);
      if (k in idx) {
        serie[idx[k]].ventas += v; serie[idx[k]].pedidos += 1; total += v; cuenta += 1;
        horas[f.getHours()].ventas += v; semana[f.getDay()].ventas += v;
      }
      if (k in idxAnt) { serie[idxAnt[k]].anterior += v; totalAnt += v; }
    });
    const mejorHora = [...horas].sort((a, b) => b.ventas - a.ventas)[0];
    const mejorDia = [...semana].sort((a, b) => b.ventas - a.ventas)[0];
    return { serie, horas, semana, total, totalAnt, cuenta, mejorHora, mejorDia, cambio: totalAnt > 0 ? Math.round(((total - totalAnt) / totalAnt) * 100) : null };
  }, [pedidos, dias]);

  if (pedidos === null) return <Skeleton className="h-72 w-full mb-8" />;

  const Tendencia = datos.cambio === null ? Minus : datos.cambio >= 0 ? TrendingUp : TrendingDown;
  const colorTend = datos.cambio === null ? 'text-muted' : datos.cambio >= 0 ? 'text-success' : 'text-danger-text';

  return (
    <section aria-label="Ventas por período" className="rounded-2xl border border-border bg-white p-4 sm:p-6 mb-8">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-head text-xl font-bold m-0">Ventas</h2>
          <p className="text-2xl font-bold font-mono mt-1 mb-0">{cop(datos.total)}</p>
          <p className={`text-sm mt-1 m-0 inline-flex items-center gap-1.5 ${colorTend}`}>
            <Tendencia size={16} />
            {datos.cambio === null ? 'Sin período anterior para comparar' : `${datos.cambio > 0 ? '+' : ''}${datos.cambio}% frente a los ${dias} días anteriores`}
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div role="group" aria-label="Período" className="flex rounded-xl border border-border overflow-hidden">
            {RANGOS.map((r) => (
              <button key={r.d} onClick={() => setDias(r.d)} aria-pressed={dias === r.d} className={`h-10 px-3 text-xs font-semibold border-none cursor-pointer ${dias === r.d ? 'bg-accent text-white' : 'bg-white text-muted'}`}>
                {r.l}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer min-h-[32px]">
            <input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} /> Comparar con el período anterior
          </label>
        </div>
      </div>

      {datos.cuenta === 0 ? (
        <p className="text-sm text-muted text-center py-12 m-0">No hay ventas confirmadas en estos {dias} días.</p>
      ) : (
        <div className="h-64" role="img" aria-label={`Gráfica de ventas diarias de los últimos ${dias} días`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={datos.serie} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C62828" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#C62828" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'var(--muted)' }} interval={dias > 14 ? Math.floor(dias / 7) : 0} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={corto} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<TooltipVentas />} />
              {comparar && <Area type="monotone" dataKey="anterior" name="Período anterior" stroke="#9AA0A6" strokeDasharray="4 4" fill="none" strokeWidth={2} />}
              <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#C62828" fill="url(#gv)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {datos.cuenta > 0 && (
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {[
            { t: 'Ventas por hora', d: datos.horas, x: 'etiqueta', mejor: datos.mejorHora.ventas > 0 ? `Tu mejor hora: ${datos.mejorHora.h}:00` : null, intervalo: 3 },
            { t: 'Ventas por día de la semana', d: datos.semana, x: 'd', mejor: datos.mejorDia.ventas > 0 ? `Tu mejor día: ${datos.mejorDia.d}` : null, intervalo: 0 },
          ].map((g) => {
            const max = Math.max(...g.d.map((e) => e.ventas));
            return (
              <div key={g.t}>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm font-bold m-0">{g.t}</h3>
                  {g.mejor && <span className="text-xs text-accent font-semibold">{g.mejor}</span>}
                </div>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={g.d} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                      <XAxis dataKey={g.x} tick={{ fontSize: 10, fill: 'var(--muted)' }} interval={g.intervalo} tickLine={false} axisLine={false} />
                      <YAxis hide />
                      <Tooltip content={<TooltipVentas />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                      <Bar dataKey="ventas" name="Ventas" radius={[4, 4, 0, 0]}>
                        {g.d.map((e, i) => <Cell key={i} fill={e.ventas === max && max > 0 ? '#C62828' : '#E8A9A7'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
