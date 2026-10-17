import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2, Store, Package, CreditCard, Smartphone } from 'lucide-react';
import api from '../services/api';
import { Character } from '../components/Illustration';
import { mensajeError } from '../utils/errores';

// Asistente de primer uso: un paso por pantalla. Cada paso guarda con los mismos endpoints que usan
// Ajustes y Productos; si ya hay datos, el paso se marca como hecho y se puede saltar.
const METODOS = [
  { id: 'nequi', label: 'Nequi', campo: 'numero_nequi', placeholder: '3001234567' },
  { id: 'bancolombia', label: 'Bancolombia', campo: 'numero_bancolombia', placeholder: 'Número de cuenta' },
  { id: 'efectivo', label: 'Efectivo / contraentrega' },
];
const PASOS = [
  { id: 'negocio', titulo: 'Tu negocio', icon: Store, personaje: 'sofia' },
  { id: 'producto', titulo: 'Tu primer producto', icon: Package, personaje: 'mateo' },
  { id: 'cobros', titulo: 'Cómo cobras', icon: CreditCard, personaje: 'lucia' },
  { id: 'whatsapp', titulo: 'Conecta WhatsApp', icon: Smartphone, personaje: 'nova' },
];

const campo = 'w-full h-12 px-4 rounded-xl border border-border bg-bg text-text text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';

export default function BienvenidaPage() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState(0);
  const [hechos, setHechos] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const [negocio, setNegocio] = useState({ tipo_negocio: '', ciudad: '', descripcion_negocio: '' });
  const [producto, setProducto] = useState({ nombre: '', precio: '' });
  const [metodos, setMetodos] = useState([]);
  const [numeros, setNumeros] = useState({ numero_nequi: '', numero_bancolombia: '' });

  // Arranca en el primer paso que falta (sin repetir lo que el usuario ya hizo)
  useEffect(() => {
    (async () => {
      const [perfil, prods] = await Promise.allSettled([api.get('/business/perfil'), api.get('/productos')]);
      const n = perfil.status === 'fulfilled' ? perfil.value.data.negocio || perfil.value.data : {};
      const lista = prods.status === 'fulfilled' ? prods.value.data.productos || prods.value.data.data || [] : [];
      const m = Array.isArray(n.metodos_pago_activos) ? n.metodos_pago_activos : [];
      setNegocio({ tipo_negocio: n.tipo_negocio || '', ciudad: n.ciudad || '', descripcion_negocio: n.descripcion_negocio || '' });
      setMetodos(m);
      setNumeros({ numero_nequi: n.numero_nequi || '', numero_bancolombia: n.numero_bancolombia || '' });
      const h = { negocio: !!(n.tipo_negocio && n.descripcion_negocio), producto: lista.length > 0, cobros: m.length > 0 };
      setHechos(h);
      const primero = ['negocio', 'producto', 'cobros'].findIndex((id) => !h[id]);
      setPaso(primero === -1 ? 3 : primero);
      setCargando(false);
    })();
  }, []);

  const actual = PASOS[paso];
  const siguiente = () => { setError(''); setPaso((p) => Math.min(p + 1, PASOS.length - 1)); };

  const guardar = async () => {
    setError('');
    setGuardando(true);
    try {
      if (actual.id === 'negocio') {
        if (!negocio.tipo_negocio.trim() || !negocio.descripcion_negocio.trim()) throw new Error('Cuéntanos qué vendes y a qué te dedicas.');
        await api.put('/business/perfil', negocio);
      } else if (actual.id === 'producto') {
        const precio = parseFloat(producto.precio);
        if (!producto.nombre.trim() || !(precio > 0)) throw new Error('Escribe el nombre y un precio mayor a 0.');
        await api.post('/productos', { nombre: producto.nombre.trim(), precio, stock: 0 });
      } else if (actual.id === 'cobros') {
        if (metodos.length === 0) throw new Error('Elige al menos una forma de cobro.');
        const faltaNumero = METODOS.find((m) => m.campo && metodos.includes(m.id) && !numeros[m.campo].trim());
        if (faltaNumero) throw new Error(`Escribe el número de ${faltaNumero.label}.`);
        await api.put('/business/perfil', {
          metodos_pago_activos: metodos,
          numero_nequi: metodos.includes('nequi') ? numeros.numero_nequi.trim() : '',
          numero_bancolombia: metodos.includes('bancolombia') ? numeros.numero_bancolombia.trim() : '',
        });
      }
      setHechos((h) => ({ ...h, [actual.id]: true }));
      siguiente();
    } catch (e) {
      setError(e.message && !e.response ? e.message : mensajeError(e, 'guardar'));
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-accent" size={32} /></div>;
  }

  const pct = Math.round((PASOS.filter((p) => hechos[p.id]).length / 3) * 100);

  return (
    <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
      <p className="text-xs font-semibold tracking-[0.04em] uppercase text-accent mb-2">Paso {paso + 1} de {PASOS.length}</p>
      <div className="h-2 rounded-full bg-bg3 overflow-hidden mb-8" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso">
        <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={actual.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
          className="bg-bg border border-border rounded-3xl p-6 sm:p-8"
        >
          <div className="flex items-end gap-4 mb-6">
            <div className="w-20 h-24 rounded-2xl bg-accent-dim flex items-end justify-center overflow-hidden shrink-0">
              <Character name={actual.personaje} height={92} alt="" />
            </div>
            <h1 className="font-head text-2xl font-extrabold text-text leading-tight">{actual.titulo}</h1>
          </div>

          {actual.id === 'negocio' && (
            <div className="space-y-4">
              <p className="text-sm text-muted">Con esto tu bot sabrá cómo presentarse a tus clientes.</p>
              <label className="block text-sm font-semibold text-text">¿Qué vendes?
                <input className={`${campo} mt-1.5 font-normal`} value={negocio.tipo_negocio} placeholder="Ej: restaurante, floristería, ropa…" onChange={(e) => setNegocio({ ...negocio, tipo_negocio: e.target.value })} />
              </label>
              <label className="block text-sm font-semibold text-text">Ciudad
                <input className={`${campo} mt-1.5 font-normal`} value={negocio.ciudad} placeholder="Ej: Medellín" onChange={(e) => setNegocio({ ...negocio, ciudad: e.target.value })} />
              </label>
              <label className="block text-sm font-semibold text-text">Descríbelo en una frase
                <textarea rows={3} className={`${campo} mt-1.5 h-auto py-3 font-normal resize-none`} value={negocio.descripcion_negocio} placeholder="Ej: Comida casera paisa con domicilio en El Poblado" onChange={(e) => setNegocio({ ...negocio, descripcion_negocio: e.target.value })} />
              </label>
            </div>
          )}

          {actual.id === 'producto' && (
            <div className="space-y-4">
              <p className="text-sm text-muted">{hechos.producto ? 'Ya tienes productos cargados. Puedes agregar otro o continuar.' : 'Empieza con uno; después cargas el resto desde Productos.'}</p>
              <label className="block text-sm font-semibold text-text">Nombre del producto
                <input className={`${campo} mt-1.5 font-normal`} value={producto.nombre} placeholder="Ej: Bandeja paisa" onChange={(e) => setProducto({ ...producto, nombre: e.target.value })} />
              </label>
              <label className="block text-sm font-semibold text-text">Precio (COP)
                <input className={`${campo} mt-1.5 font-normal`} inputMode="numeric" value={producto.precio} placeholder="28000" onChange={(e) => setProducto({ ...producto, precio: e.target.value.replace(/[^\d.]/g, '') })} />
              </label>
            </div>
          )}

          {actual.id === 'cobros' && (
            <div className="space-y-3">
              <p className="text-sm text-muted">El bot ofrece estas opciones al cerrar la venta.</p>
              {METODOS.map((m) => {
                const activo = metodos.includes(m.id);
                return (
                  <div key={m.id} className={`rounded-xl border p-3 ${activo ? 'border-accent/50 bg-accent-dim' : 'border-border'}`}>
                    <label className="flex items-center gap-3 cursor-pointer min-h-11">
                      <input type="checkbox" className="w-5 h-5 accent-[var(--accent)]" checked={activo} onChange={() => setMetodos((cur) => (cur.includes(m.id) ? cur.filter((x) => x !== m.id) : [...cur, m.id]))} />
                      <span className="text-sm font-semibold text-text">{m.label}</span>
                    </label>
                    {activo && m.campo && (
                      <input className={`${campo} mt-2`} inputMode="numeric" aria-label={`Número de ${m.label}`} placeholder={m.placeholder} value={numeros[m.campo]} onChange={(e) => setNumeros({ ...numeros, [m.campo]: e.target.value })} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {actual.id === 'whatsapp' && (
            <div className="space-y-4">
              <p className="text-sm text-muted leading-6">
                ¡Casi listo! Al conectar tu WhatsApp se enciende tu bot y <strong className="text-text">empieza tu prueba gratis de 7 días</strong>. Escanearás un código QR desde tu celular.
              </p>
              <ul className="list-none p-0 m-0 space-y-2">
                {PASOS.slice(0, 3).map((p) => (
                  <li key={p.id} className="flex items-center gap-3 text-sm">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center ${hechos[p.id] ? 'bg-success text-white' : 'bg-bg3 text-muted'}`}><Check size={14} /></span>
                    <span className={hechos[p.id] ? 'text-text' : 'text-muted'}>{p.titulo}{!hechos[p.id] && ' (pendiente)'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p role="alert" className="mt-4 text-sm text-danger-text">{error}</p>}

          <div className="flex items-center gap-3 mt-8">
            {paso > 0 && (
              <button onClick={() => { setError(''); setPaso(paso - 1); }} aria-label="Paso anterior" className="h-12 w-12 rounded-xl border border-border bg-bg text-text flex items-center justify-center cursor-pointer">
                <ArrowLeft size={18} />
              </button>
            )}
            {actual.id === 'whatsapp' ? (
              <button onClick={() => navigate('/whatsapp')} className="flex-1 h-12 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold border-none cursor-pointer inline-flex items-center justify-center gap-2">
                Conectar WhatsApp <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <button onClick={guardar} disabled={guardando} className="flex-1 h-12 rounded-xl bg-accent hover:bg-accent2 disabled:opacity-60 text-white text-sm font-semibold border-none cursor-pointer inline-flex items-center justify-center gap-2">
                  {guardando ? <Loader2 size={16} className="animate-spin" /> : <>Guardar y seguir <ArrowRight size={16} /></>}
                </button>
                <button onClick={siguiente} className="h-12 px-4 rounded-xl bg-transparent border-none text-muted text-sm font-semibold cursor-pointer hover:text-text">
                  {hechos[actual.id] ? 'Seguir' : 'Saltar'}
                </button>
              </>
            )}
          </div>
        </motion.section>
      </AnimatePresence>

      <button onClick={() => navigate('/dashboard')} className="mt-6 mx-auto block bg-transparent border-none text-sm text-muted cursor-pointer hover:text-text underline">
        Lo hago después
      </button>
    </div>
  );
}
