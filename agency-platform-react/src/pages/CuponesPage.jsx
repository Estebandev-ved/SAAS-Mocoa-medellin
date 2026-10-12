import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Tag, Loader2, Plus, Trash2 } from 'lucide-react';
import api from '../services/api';
import TipNova from '../components/TipNova';
import FeedbackMessage from '../components/FeedbackMessage';
import AyudaRapida from '../components/AyudaRapida';
import EmptyState from '../components/EmptyState';
import { mensajeError } from '../utils/errores';

const LABEL = 'block text-sm font-semibold text-text mb-2';
const CONTROL =
  'w-full h-11 bg-white border border-[#C9C9C9] rounded-xl px-4 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors';

const VACIO = { codigo: '', tipo: 'porcentaje', valor: '', minimo_compra: '', usos_max: '', vence_el: '' };

// Cupones de ejemplo para quien no sabe por dónde empezar.
const EJEMPLOS = [
  { etiqueta: '10% de bienvenida', datos: { codigo: 'BIENVENIDO10', tipo: 'porcentaje', valor: '10', minimo_compra: '', usos_max: '', vence_el: '' } },
  { etiqueta: '$5.000 de descuento', datos: { codigo: 'AHORRA5000', tipo: 'fijo', valor: '5000', minimo_compra: '30000', usos_max: '50', vence_el: '' } },
  { etiqueta: '20% por pocos días', datos: { codigo: 'FINDE20', tipo: 'porcentaje', valor: '20', minimo_compra: '', usos_max: '30', vence_el: '' } },
];

const dinero = (n) => `$${Number(n).toLocaleString('es-CO')}`;

function estadoCupon(c) {
  if (!c.activo) return { texto: 'Desactivado', clase: 'text-muted bg-bg2' };
  if (c.vence_el && new Date(c.vence_el) < new Date(new Date().toDateString())) return { texto: 'Vencido', clase: 'text-danger bg-danger/10' };
  if (c.usos_max != null && c.usos >= c.usos_max) return { texto: 'Agotado', clase: 'text-danger bg-danger/10' };
  return { texto: 'Activo', clase: 'text-success bg-success/10' };
}

export default function CuponesPage() {
  const navigate = useNavigate();
  const [cupones, setCupones] = useState([]);
  const [form, setForm] = useState(VACIO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function cargar() {
    try {
      const r = await api.get('/cupones');
      setCupones(r.data.cupones || []);
    } catch (e) {
      setMsg({ type: 'error', text: mensajeError(e, 'cargar los cupones') });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.post('/cupones', form);
      setForm(VACIO);
      setMsg({ type: 'success', text: `Cupón ${form.codigo} creado. Ahora compártelo: pégalo en una campaña, en tus redes o en la automatización de recuperar pedidos. El cliente solo tiene que escribirlo al hacer su pedido.` });
      cargar();
    } catch (err) {
      setMsg({ type: 'error', text: mensajeError(err, 'crear el cupón') });
    } finally {
      setSaving(false);
    }
  }

  async function alternar(id) {
    try {
      await api.patch(`/cupones/${id}/toggle`);
      cargar();
    } catch (err) {
      setMsg({ type: 'error', text: mensajeError(err, 'cambiar el estado del cupón') });
    }
  }

  async function borrar(id) {
    if (!window.confirm('¿Eliminar este cupón? Los pedidos que ya lo usaron no se afectan.')) return;
    try {
      await api.delete(`/cupones/${id}`);
      cargar();
    } catch (err) {
      setMsg({ type: 'error', text: mensajeError(err, 'eliminar el cupón') });
    }
  }

  return (
    <div className="min-h-screen bg-bg2 p-6 lg:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            aria-label="Volver al panel"
            className="w-11 h-11 rounded-xl bg-white border border-border flex items-center justify-center cursor-pointer hover:border-[#C9C9C9] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted" />
          </button>
          <div>
            <h1 className="font-head text-3xl font-bold text-text tracking-tight">Cupones</h1>
            <p className="text-muted text-sm mt-1">Códigos de descuento que tu bot aplica solo</p>
          </div>
        </div>

        <AyudaRapida
          guia="cupones"
          pasos={[
            'Elige un ejemplo (o escribe tu propio código, por ejemplo VERANO10) y define cuánto descuenta.',
            'Pulsa “Crear cupón” y compártelo con tus clientes: en una campaña, en redes o por WhatsApp.',
            'El cliente escribe el código al hacer su pedido y el bot aplica el descuento solo. Aquí ves cuántas veces se usó.',
          ]}
        />

        <TipNova id="cupones">
          Crea un código (por ejemplo VERANO10). Cuando un cliente lo escriba al hacer su pedido, el bot valida el
          cupón y descuenta el valor. Puedes compartirlo en una campaña o en la recuperación de pedidos.
        </TipNova>

        {msg && <FeedbackMessage type={msg.type}>{msg.text}</FeedbackMessage>}

        <form onSubmit={crear} className="bg-white border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-accent" />
            <h2 className="font-head text-xl font-bold text-text">Nuevo cupón</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted">¿No sabes por dónde empezar? Prueba un ejemplo:</span>
            {EJEMPLOS.map((e) => (
              <button
                key={e.etiqueta}
                type="button"
                onClick={() => setForm(e.datos)}
                className="h-8 px-3 rounded-xl bg-[#FDECEA] border border-accent/20 text-xs font-semibold text-accent cursor-pointer hover:bg-accent-dim"
              >
                {e.etiqueta}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Código</label>
              <input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                placeholder="VERANO10"
                maxLength={30}
                required
                className={CONTROL}
              />
            </div>
            <div>
              <label className={LABEL}>Tipo de descuento</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={CONTROL}>
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="fijo">Valor fijo ($)</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>{form.tipo === 'porcentaje' ? 'Porcentaje (máx. 90)' : 'Valor del descuento ($)'}</label>
              <input
                type="number"
                min={1}
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                required
                className={CONTROL}
              />
            </div>
            <div>
              <label className={LABEL}>Compra mínima ($, opcional)</label>
              <input
                type="number"
                min={0}
                value={form.minimo_compra}
                onChange={(e) => setForm({ ...form, minimo_compra: e.target.value })}
                className={CONTROL}
              />
            </div>
            <div>
              <label className={LABEL}>Usos máximos (opcional)</label>
              <input
                type="number"
                min={1}
                value={form.usos_max}
                onChange={(e) => setForm({ ...form, usos_max: e.target.value })}
                placeholder="Sin límite"
                className={CONTROL}
              />
            </div>
            <div>
              <label className={LABEL}>Vence el (opcional)</label>
              <input type="date" value={form.vence_el} onChange={(e) => setForm({ ...form, vence_el: e.target.value })} className={CONTROL} />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-11 px-5 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold border-none cursor-pointer transition-colors inline-flex items-center gap-2 disabled:bg-[#F0F0F0] disabled:text-muted disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear cupón
          </button>
        </form>

        <div className="bg-white border border-border rounded-2xl p-6">
          <h2 className="font-head text-xl font-bold text-text mb-4">Tus cupones</h2>
          {loading ? (
            <Loader2 className="animate-spin text-accent" />
          ) : cupones.length === 0 ? (
            <EmptyState
              character="sofia"
              size={110}
              className="py-6"
              title="Aún no tienes cupones"
              description="Un cupón es un código que tus clientes escriben al pedir para recibir un descuento. Crea el primero con un ejemplo."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setForm(EJEMPLOS[0].datos);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="h-10 px-4 rounded-xl bg-accent text-white text-sm font-semibold border-none cursor-pointer"
                >
                  Empezar con un ejemplo
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {cupones.map((c) => {
                const est = estadoCupon(c);
                return (
                  <div key={c.id} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-text text-sm">{c.codigo}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${est.clase}`}>{est.texto}</span>
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {c.tipo === 'porcentaje' ? `${Number(c.valor)}% de descuento` : `${dinero(c.valor)} de descuento`}
                        {Number(c.minimo_compra) > 0 ? ` · compra mínima ${dinero(c.minimo_compra)}` : ''}
                        {' · '}
                        {c.usos}
                        {c.usos_max != null ? `/${c.usos_max}` : ''} usos
                        {c.vence_el ? ` · vence ${String(c.vence_el).slice(0, 10)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => alternar(c.id)}
                        className="h-9 px-3 rounded-lg border border-border bg-white text-xs font-semibold text-text cursor-pointer hover:bg-bg2"
                      >
                        {c.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => borrar(c.id)}
                        aria-label="Eliminar cupón"
                        className="w-9 h-9 rounded-lg border border-border bg-white flex items-center justify-center cursor-pointer hover:bg-bg2"
                      >
                        <Trash2 size={14} className="text-muted" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
