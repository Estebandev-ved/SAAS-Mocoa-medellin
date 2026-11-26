import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Minus, Trash2, Loader2, Banknote, Smartphone, CreditCard, ArrowLeftRight, Receipt, Undo2, Lock, TrendingUp, HandCoins, MessageCircle, UserPlus } from 'lucide-react';
import api from '../services/api';
import Toast from '../components/Toast';
import { useConfirm } from '../context/ConfirmContext';
import { mensajeError } from '../utils/errores';

// Venta de mostrador: cobrar en el local con el mismo inventario que usa el bot (docs/ecosistema-inventario-facturacion.md).
// Turnos con arqueo y gastos son de la caja avanzada (plan Profesional en adelante).
const METODOS = [
  { id: 'efectivo', label: 'Efectivo', icono: Banknote },
  { id: 'nequi', label: 'Nequi', icono: Smartphone },
  { id: 'tarjeta', label: 'Tarjeta', icono: CreditCard },
  { id: 'transferencia', label: 'Transferencia', icono: ArrowLeftRight },
  { id: 'fiado', label: 'Fiado', icono: HandCoins },
];
const CONTROL = 'w-full bg-white border border-[#C9C9C9] rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-accent';
const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

export default function MostradorPage() {
  const confirmar = useConfirm();
  const [productos, setProductos] = useState([]);
  const [busca, setBusca] = useState('');
  const [carrito, setCarrito] = useState({});          // producto_id → cantidad
  const [metodo, setMetodo] = useState('efectivo');
  const [recibido, setRecibido] = useState('');
  const [cobrando, setCobrando] = useState(false);
  const [fiado, setFiado] = useState({ clientes: [], total_por_cobrar: 0, deudores: 0 });
  const [clienteId, setClienteId] = useState('');       // a quién se le fía esta venta
  const [nuevo, setNuevo] = useState(null);             // null = oculto; { nombre, telefono } = formulario de cliente nuevo
  const [ventas, setVentas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [turno, setTurno] = useState(undefined);       // undefined = cargando, null = sin turno, false = plan sin caja avanzada
  const [cargando, setCargando] = useState(true);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [toast, setToast] = useState(null);
  const aviso = (type, message) => setToast({ type, message });

  const cargarVentas = useCallback(async () => {
    const [v, r] = await Promise.all([api.get('/mostrador/ventas'), api.get('/mostrador/resumen-dia')]);
    setVentas(Array.isArray(v.data?.ventas) ? v.data.ventas : []);
    setResumen(r.data || null);
  }, []);
  const cargarFiado = useCallback(async () => {
    try {
      const { data } = await api.get('/mostrador/fiado');
      setFiado({ clientes: Array.isArray(data?.clientes) ? data.clientes : [], total_por_cobrar: data?.total_por_cobrar || 0, deudores: data?.deudores || 0 });
    } catch { /* el fiado es un extra: si falla, la venta sigue funcionando */ }
  }, []);
  const cargarTurno = useCallback(async () => {
    try {
      const { data } = await api.get('/mostrador/turno/actual');
      setTurno(data?.turno || null);
    } catch (e) {
      setTurno(e?.response?.status === 403 ? false : null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/mostrador/productos');
        setProductos(Array.isArray(data?.productos) ? data.productos : []);
        await Promise.all([cargarVentas(), cargarTurno(), cargarFiado()]);
      } catch (e) {
        if (e?.response?.status === 403) setSinAcceso(true); else aviso('error', mensajeError(e, 'cargar la caja'));
      } finally { setCargando(false); }
    })();
  }, [cargarVentas, cargarTurno, cargarFiado]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return productos.filter((p) => !q || p.nombre.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  }, [productos, busca]);
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const lineas = Object.entries(carrito).map(([id, cantidad]) => ({ p: porId.get(Number(id)), cantidad })).filter((l) => l.p);
  const total = lineas.reduce((s, l) => s + l.p.precio * l.cantidad, 0);
  const cambio = metodo === 'efectivo' && recibido !== '' ? Number(recibido) - total : null;

  const cambiar = (p, delta) => setCarrito((c) => {
    const nueva = (c[p.id] || 0) + delta;
    const { [p.id]: _quitar, ...resto } = c;
    if (nueva <= 0) return resto;
    // Si controla inventario, no deja pasar de lo que hay (el servidor lo vuelve a comprobar).
    return { ...resto, [p.id]: p.controla_stock ? Math.min(nueva, Math.max(0, p.stock)) : nueva };
  });

  const cobrar = async () => {
    if (!lineas.length || cobrando) return;
    if (metodo === 'efectivo' && recibido !== '' && Number(recibido) < total) { aviso('error', 'Lo recibido no cubre el total'); return; }
    if (metodo === 'fiado' && !clienteId) { aviso('error', 'Elige a quién le fías'); return; }
    setCobrando(true);
    try {
      const { data } = await api.post('/mostrador/ventas', {
        items: lineas.map((l) => ({ producto_id: l.p.id, cantidad: l.cantidad })),
        metodo_pago: metodo, recibido: metodo === 'efectivo' && recibido !== '' ? Number(recibido) : undefined,
        cliente_id: metodo === 'fiado' ? Number(clienteId) : undefined,
      });
      const v = data.venta;
      aviso('success', metodo === 'fiado'
        ? `Venta ${v.numero} fiada: ${pesos(v.total)}`
        : `Venta ${v.numero} cobrada: ${pesos(v.total)}${v.cambio ? ` · devuelve ${pesos(v.cambio)}` : ''}`);
      setCarrito({}); setRecibido(''); setClienteId('');
      const { data: pr } = await api.get('/mostrador/productos');
      setProductos(Array.isArray(pr?.productos) ? pr.productos : []);
      await Promise.all([cargarVentas(), cargarTurno(), cargarFiado()]);
    } catch (e) {
      aviso('error', mensajeError(e, 'cobrar'));
    } finally { setCobrando(false); }
  };

  const anular = async (v) => {
    if (!(await confirmar({ titulo: `¿Anular la venta ${v.numero}?`, mensaje: 'Los productos con inventario vuelven al stock. No se puede deshacer.', boton: 'Anular venta', peligro: true }))) return;
    try {
      await api.post(`/mostrador/ventas/${v.id}/anular`);
      aviso('success', 'Venta anulada y stock devuelto');
      const { data } = await api.get('/mostrador/productos');
      setProductos(Array.isArray(data?.productos) ? data.productos : []);
      await Promise.all([cargarVentas(), cargarTurno(), cargarFiado()]);
    } catch (e) { aviso('error', mensajeError(e, 'anular la venta')); }
  };

  if (cargando) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>;
  if (sinAcceso) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        <Lock className="w-8 h-8 mx-auto text-muted mb-3" />
        <h1 className="font-head text-xl text-text mb-2">Venta de mostrador</h1>
        <p className="text-sm text-muted">Cobrar en el local con tu inventario viene en los planes Inicial, Profesional y Empresarial. Los planes Emprendedor y Universitario usan la Caja.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-head text-2xl text-text">Venta rápida</h1>
          <p className="text-sm text-muted">Cobra en el local. Lo que vendes aquí descuenta del mismo inventario que el bot.</p>
        </div>
        {resumen && (
          <div className="text-right text-sm">
            <p className="text-muted">Hoy: {resumen.ventas} {resumen.ventas === 1 ? 'venta' : 'ventas'}</p>
            <p className="font-head text-lg text-text">{pesos(resumen.total)}</p>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
        <section>
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar producto o código" className={`${CONTROL} pl-9`} />
          </div>
          {lista.length === 0 ? (
            <p className="text-sm text-muted p-6 text-center">{productos.length ? 'Ningún producto coincide.' : 'Aún no tienes productos. Créalos en Productos e inventario.'}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {lista.map((p) => {
                const agotado = p.controla_stock && p.stock <= 0;
                return (
                  <button key={p.id} type="button" disabled={agotado} onClick={() => cambiar(p, 1)}
                    className={`text-left bg-white border border-border rounded-xl p-3 min-h-[76px] cursor-pointer ${agotado ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent'}`}>
                    <p className="text-sm font-semibold text-text leading-tight">{p.nombre}</p>
                    <p className="text-sm text-text mt-1">{pesos(p.precio)}</p>
                    {p.controla_stock && <p className={`text-xs mt-0.5 ${agotado ? 'text-danger-text' : 'text-muted'}`}>{agotado ? 'Agotado' : `${p.stock} en stock`}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="bg-white border border-border rounded-2xl p-4 lg:sticky lg:top-4">
          <h2 className="font-head text-lg text-text mb-3">Cuenta</h2>
          {lineas.length === 0 ? <p className="text-sm text-muted mb-3">Toca un producto para agregarlo.</p> : (
            <ul className="mb-3 divide-y divide-border">
              {lineas.map((l) => (
                <li key={l.p.id} className="py-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0"><p className="text-sm text-text truncate">{l.p.nombre}</p><p className="text-xs text-muted">{pesos(l.p.precio)} c/u</p></div>
                  <button type="button" aria-label="Quitar uno" onClick={() => cambiar(l.p, -1)} className="w-9 h-9 rounded-lg border border-border bg-white cursor-pointer"><Minus className="w-4 h-4 mx-auto" /></button>
                  <span className="w-6 text-center text-sm">{l.cantidad}</span>
                  <button type="button" aria-label="Agregar uno" onClick={() => cambiar(l.p, 1)} className="w-9 h-9 rounded-lg border border-border bg-white cursor-pointer"><Plus className="w-4 h-4 mx-auto" /></button>
                  <button type="button" aria-label="Quitar producto" onClick={() => cambiar(l.p, -l.cantidad)} className="w-9 h-9 rounded-lg border-none bg-transparent text-muted cursor-pointer"><Trash2 className="w-4 h-4 mx-auto" /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-between items-baseline mb-3"><span className="text-sm text-muted">Total</span><span className="font-head text-2xl text-text">{pesos(total)}</span></div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {METODOS.map((m) => (
              <button key={m.id} type="button" onClick={() => setMetodo(m.id)} aria-pressed={metodo === m.id}
                className={`h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer border ${metodo === m.id ? 'bg-text text-bg border-text' : 'bg-white text-muted border-border'}`}>
                <m.icono className="w-4 h-4" />{m.label}
              </button>
            ))}
          </div>
          {metodo === 'efectivo' && (
            <label className="block mb-3 text-xs font-semibold text-text">Recibido (opcional)
              <input type="number" inputMode="numeric" min="0" value={recibido} onChange={(e) => setRecibido(e.target.value)} className={`${CONTROL} mt-1 font-normal`} />
              {cambio !== null && <span className={`block mt-1 font-normal ${cambio < 0 ? 'text-danger-text' : 'text-success'}`}>{cambio < 0 ? `Faltan ${pesos(-cambio)}` : `Devuelve ${pesos(cambio)}`}</span>}
            </label>
          )}
          {metodo === 'fiado' && (
            <div className="mb-3">
              <label className="block text-xs font-semibold text-text" htmlFor="fiado-cliente">¿A quién le fías?</label>
              <div className="flex gap-2 mt-1">
                <select id="fiado-cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={CONTROL}>
                  <option value="">Elige un cliente</option>
                  {fiado.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.saldo > 0 ? ` · debe ${pesos(c.saldo)}` : ''}</option>)}
                </select>
                <button type="button" aria-label="Cliente nuevo" onClick={() => setNuevo(nuevo ? null : { nombre: '', telefono: '' })}
                  className="w-11 h-10 shrink-0 rounded-xl border border-border bg-white cursor-pointer"><UserPlus className="w-4 h-4 mx-auto" /></button>
              </div>
              {nuevo && (
                <div className="mt-2 grid gap-2">
                  <input placeholder="Nombre" maxLength={80} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className={CONTROL} />
                  <input placeholder="Celular (opcional, para recordarle)" inputMode="tel" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} className={CONTROL} />
                  <button type="button" disabled={!nuevo.nombre.trim()} onClick={async () => {
                    try {
                      const { data } = await api.post('/mostrador/fiado/clientes', nuevo);
                      await cargarFiado(); setClienteId(String(data.cliente.id)); setNuevo(null);
                    } catch (e) { aviso('error', mensajeError(e, 'guardar el cliente')); }
                  }} className="h-10 rounded-xl border border-border bg-white text-sm font-semibold cursor-pointer disabled:opacity-50">Guardar cliente</button>
                </div>
              )}
              <p className="text-xs text-muted mt-1">No entra plata ahora: queda anotado lo que te debe.</p>
            </div>
          )}
          <button type="button" onClick={cobrar} disabled={!lineas.length || cobrando}
            className="w-full h-12 rounded-xl bg-accent text-white font-semibold border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {cobrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}{metodo === 'fiado' ? 'Fiar' : 'Cobrar'} {pesos(total)}
          </button>
        </aside>
      </div>

      <Ganancia refrescar={ventas} sinCosto={productos.filter((p) => p.costo === null || p.costo === undefined).length} />

      <PorCobrar fiado={fiado} recargar={async () => { await Promise.all([cargarFiado(), cargarTurno()]); }} aviso={aviso} />

      <TurnoCaja turno={turno} recargar={cargarTurno} aviso={aviso} />

      <section className="mt-6">
        <h2 className="font-head text-lg text-text mb-2">Ventas de hoy</h2>
        {ventas.length === 0 ? <p className="text-sm text-muted">Todavía no hay ventas hoy.</p> : (
          <ul className="bg-white border border-border rounded-2xl divide-y divide-border">
            {ventas.map((v) => (
              <li key={v.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text">{v.numero} · {pesos(v.total)} <span className="text-muted">· {v.metodo_pago}</span>{v.estado === 'anulada' && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-danger/10 text-danger-text">Anulada</span>}</p>
                  <p className="text-xs text-muted truncate">{v.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ')}</p>
                </div>
                {v.estado === 'pagada' && (
                  <button type="button" onClick={() => anular(v)} className="h-9 px-3 rounded-lg border border-border bg-white text-xs text-muted cursor-pointer flex items-center gap-1"><Undo2 className="w-3.5 h-3.5" />Anular</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const METODOS_ABONO = METODOS.filter((m) => m.id !== 'fiado');

// Fiado: quién te debe y cuánto. Abonar baja la deuda; un abono en efectivo entra al arqueo del turno.
function PorCobrar({ fiado, recargar, aviso }) {
  const [abriendo, setAbriendo] = useState(null);        // id del cliente con el formulario de abono abierto
  const [abono, setAbono] = useState({ monto: '', metodo_pago: 'efectivo' });
  const [historial, setHistorial] = useState(null);      // { id, movimientos } del cliente que se está viendo
  const [ocupado, setOcupado] = useState(false);
  const deudores = fiado.clientes.filter((c) => c.saldo > 0);
  if (fiado.clientes.length === 0) {
    return <p className="mt-6 text-xs text-muted">¿Fías a veces? Elige <strong>Fiado</strong> al cobrar y aquí queda anotado quién te debe y cuánto.</p>;
  }

  const abonar = async (c) => {
    setOcupado(true);
    try {
      const { data } = await api.post(`/mostrador/fiado/clientes/${c.id}/abonos`, { monto: Number(abono.monto), metodo_pago: abono.metodo_pago });
      aviso('success', data.saldo > 0 ? `Abono anotado. ${c.nombre} aún debe ${pesos(data.saldo)}` : `${c.nombre} quedó al día ✔`);
      setAbriendo(null); setAbono({ monto: '', metodo_pago: 'efectivo' }); setHistorial(null);
      await recargar();
    } catch (e) { aviso('error', mensajeError(e, 'anotar el abono')); } finally { setOcupado(false); }
  };

  const verHistorial = async (c) => {
    if (historial?.id === c.id) { setHistorial(null); return; }
    try {
      const { data } = await api.get(`/mostrador/fiado/clientes/${c.id}`);
      setHistorial({ id: c.id, movimientos: data.movimientos || [] });
    } catch (e) { aviso('error', mensajeError(e, 'cargar el historial')); }
  };

  const recordatorio = (c) => `https://wa.me/${c.telefono}?text=${encodeURIComponent(`Hola ${c.nombre}, te recuerdo que tienes un saldo pendiente de ${pesos(c.saldo)}. ¡Gracias!`)}`;

  return (
    <section className="mt-6 bg-white border border-border rounded-2xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 className="font-head text-lg text-text flex items-center gap-2"><HandCoins className="w-5 h-5 text-muted" />Me deben</h2>
        <p className="font-head text-2xl text-text">{pesos(fiado.total_por_cobrar)}</p>
      </div>
      {deudores.length === 0 ? <p className="text-sm text-muted">Nadie te debe nada. 🎉</p> : (
        <ul className="divide-y divide-border">
          {deudores.map((c) => (
            <li key={c.id} className="py-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0"><p className="text-sm text-text truncate">{c.nombre}</p><p className="text-sm font-semibold text-text">{pesos(c.saldo)}</p></div>
                {c.telefono && (
                  <a href={recordatorio(c)} target="_blank" rel="noopener noreferrer" aria-label={`Recordarle a ${c.nombre} por WhatsApp`}
                    className="w-9 h-9 rounded-lg border border-border bg-white text-muted flex items-center justify-center"><MessageCircle className="w-4 h-4" /></a>
                )}
                <button type="button" onClick={() => verHistorial(c)} className="h-9 px-3 rounded-lg border border-border bg-white text-xs text-muted cursor-pointer">Historial</button>
                <button type="button" onClick={() => { setAbriendo(abriendo === c.id ? null : c.id); setAbono({ monto: '', metodo_pago: 'efectivo' }); }}
                  className="h-9 px-3 rounded-lg bg-accent text-white text-xs font-semibold border-none cursor-pointer">Abonar</button>
              </div>
              {abriendo === c.id && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="text-xs font-semibold text-text">Cuánto paga
                    <input type="number" min="0" inputMode="numeric" value={abono.monto} onChange={(e) => setAbono({ ...abono, monto: e.target.value })} className={`${CONTROL} mt-1 font-normal w-36`} />
                  </label>
                  <button type="button" onClick={() => setAbono({ ...abono, monto: String(c.saldo) })} className="h-10 px-3 rounded-xl border border-border bg-white text-xs cursor-pointer">Todo ({pesos(c.saldo)})</button>
                  <select aria-label="Cómo paga" value={abono.metodo_pago} onChange={(e) => setAbono({ ...abono, metodo_pago: e.target.value })} className={`${CONTROL} w-36`}>
                    {METODOS_ABONO.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <button type="button" disabled={ocupado || !(Number(abono.monto) > 0)} onClick={() => abonar(c)}
                    className="h-10 px-4 rounded-xl bg-text text-bg text-sm font-semibold border-none cursor-pointer disabled:opacity-50">Anotar pago</button>
                </div>
              )}
              {historial?.id === c.id && (
                <ul className="mt-2 text-xs text-muted space-y-0.5">
                  {historial.movimientos.length === 0 ? <li>Sin movimientos.</li> : historial.movimientos.map((m) => (
                    <li key={m.id} className={m.anulado ? 'line-through' : ''}>
                      {new Date(m.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {m.tipo === 'cargo' ? `Fiado${m.venta_numero ? ` (${m.venta_numero})` : ''}` : `Pagó (${m.metodo_pago})`}: <strong className="text-text">{pesos(m.monto)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const PERIODOS = [{ id: 'hoy', label: 'Hoy' }, { id: 'semana', label: '7 días' }, { id: 'mes', label: 'Este mes' }];

// ¿Cuánto gané? Ventas − lo que costaron los productos − gastos. Se recalcula cada vez que cambia la lista de ventas de hoy.
function Ganancia({ refrescar, sinCosto }) {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState('hoy');
  const [datos, setDatos] = useState(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vigente = true;
    api.get('/mostrador/ganancia', { params: { periodo } })
      .then(({ data }) => { if (vigente) { setDatos(data); setFallo(false); } })
      .catch(() => { if (vigente) setFallo(true); });
    return () => { vigente = false; };
  }, [periodo, refrescar]);

  const negativa = datos && datos.ganancia_neta < 0;
  return (
    <section className="mt-6 bg-white border border-border rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-head text-lg text-text flex items-center gap-2"><TrendingUp className="w-5 h-5 text-muted" />¿Cuánto gané?</h2>
        <div className="flex gap-1" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPeriodo(p.id)} aria-pressed={periodo === p.id}
              className={`h-9 px-3 rounded-lg text-xs font-semibold cursor-pointer border ${periodo === p.id ? 'bg-text text-bg border-text' : 'bg-white text-muted border-border'}`}>{p.label}</button>
          ))}
        </div>
      </div>
      {fallo && <p className="text-sm text-muted">No pude calcular la ganancia ahora. Intenta de nuevo en un momento.</p>}
      {!fallo && !datos && <Loader2 className="w-4 h-4 animate-spin text-muted" />}
      {!fallo && datos && (
        <>
          <p className={`font-head text-3xl ${negativa ? 'text-danger-text' : 'text-text'}`}>{pesos(datos.ganancia_neta)}</p>
          <p className="text-sm text-muted mb-3">
            {datos.ventas === 0 ? 'Todavía no hay ventas en este período.' : `${datos.etiqueta}: ${datos.ventas} ${datos.ventas === 1 ? 'venta' : 'ventas'} por ${pesos(datos.ingresos)}`}
            {datos.margen !== null && ` · te queda el ${datos.margen}% de lo que vendes`}
          </p>
          <dl className="grid grid-cols-3 gap-2 text-sm mb-3">
            <div className="bg-bg rounded-xl p-2"><dt className="text-xs text-muted">Costo de lo vendido</dt><dd className="text-text font-semibold">{pesos(datos.costo)}</dd></div>
            <div className="bg-bg rounded-xl p-2"><dt className="text-xs text-muted">Gastos</dt><dd className="text-text font-semibold">{pesos(datos.gastos)}</dd></div>
            <div className="bg-bg rounded-xl p-2"><dt className="text-xs text-muted">Ganancia de productos</dt><dd className="text-text font-semibold">{pesos(datos.ganancia_bruta)}</dd></div>
          </dl>
          {!datos.completo && (
            <p className="text-xs text-warn-text bg-warn/15 rounded-lg p-2 mb-3">
              {pesos(datos.ventas_sin_costo)} de lo vendido no tiene costo anotado, así que no entra en esta ganancia. Anota el costo de tus productos para ver el número completo.
            </p>
          )}
          {datos.mejores.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted mb-1">Lo que más te dejó</p>
              <ul className="text-sm text-text divide-y divide-border">
                {datos.mejores.map((m) => (
                  <li key={m.nombre} className="py-1.5 flex justify-between gap-2"><span className="truncate">{m.nombre} <span className="text-muted">· {m.unidades} {m.unidades === 1 ? 'vendido' : 'vendidos'}</span></span><span className="font-semibold">{pesos(m.ganancia)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {sinCosto > 0 && (
        <button type="button" onClick={() => navigate('/productos')} className="mt-3 text-xs text-accent underline bg-transparent border-none cursor-pointer p-0">
          {sinCosto === 1 ? 'Te falta el costo de 1 producto' : `Te faltan los costos de ${sinCosto} productos`} → anótalos en Productos
        </button>
      )}
    </section>
  );
}

// Turno con arqueo: abrir con la plata inicial, anotar gastos y cerrar contando la caja.
function TurnoCaja({ turno, recargar, aviso }) {
  const [inicial, setInicial] = useState('');
  const [gasto, setGasto] = useState({ concepto: '', monto: '' });
  const [contado, setContado] = useState('');
  const [cierre, setCierre] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  if (turno === undefined) return null;

  const hacer = async (fn, ok) => {
    setOcupado(true);
    try { await fn(); if (ok) aviso('success', ok); await recargar(); } catch (e) { aviso('error', mensajeError(e, 'completar la acción')); } finally { setOcupado(false); }
  };

  return (
    <section className="mt-6 bg-white border border-border rounded-2xl p-4">
      <h2 className="font-head text-lg text-text mb-1">Turno de caja</h2>
      {turno === false ? (
        <p className="text-sm text-muted flex items-center gap-2"><Lock className="w-4 h-4" />Abrir y cerrar turnos con arqueo y registrar gastos es de la caja avanzada (plan Profesional o Empresarial).</p>
      ) : cierre ? (
        <div className="text-sm text-text">
          <p className="font-semibold mb-1">Turno cerrado</p>
          <p>Ventas: {pesos(cierre.total_ventas)} · Gastos: {pesos(cierre.gastos)}</p>
          <p>Debía haber en efectivo: {pesos(cierre.efectivo_esperado)} · Contaste: {pesos(cierre.monto_contado)}</p>
          <p className={cierre.diferencia === 0 ? 'text-success font-semibold' : 'text-danger-text font-semibold'}>
            {cierre.diferencia === 0 ? 'La caja cuadra ✔' : cierre.diferencia > 0 ? `Sobran ${pesos(cierre.diferencia)}` : `Faltan ${pesos(-cierre.diferencia)}`}
          </p>
          <button type="button" onClick={() => setCierre(null)} className="mt-2 h-9 px-3 rounded-lg border border-border bg-white text-xs cursor-pointer">Listo</button>
        </div>
      ) : turno === null ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-text">Plata con la que abres
            <input type="number" min="0" inputMode="numeric" value={inicial} onChange={(e) => setInicial(e.target.value)} className={`${CONTROL} mt-1 font-normal w-44`} />
          </label>
          <button type="button" disabled={ocupado} onClick={() => hacer(() => api.post('/mostrador/turno/abrir', { monto_inicial: Number(inicial) || 0 }), 'Turno abierto')}
            className="h-10 px-4 rounded-xl bg-accent text-white text-sm font-semibold border-none cursor-pointer disabled:opacity-50">Abrir turno</button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted mb-2">Abierto con {pesos(turno.monto_inicial)} · {turno.ventas} ventas · {pesos(turno.total_ventas)} · gastos {pesos(turno.gastos)} · <strong className="text-text">efectivo esperado {pesos(turno.efectivo_esperado)}</strong></p>
          <div className="flex flex-wrap items-end gap-2 mb-3">
            <input placeholder="Gasto (ej. hielo)" value={gasto.concepto} onChange={(e) => setGasto({ ...gasto, concepto: e.target.value })} className={`${CONTROL} w-44`} />
            <input type="number" min="0" placeholder="Valor" value={gasto.monto} onChange={(e) => setGasto({ ...gasto, monto: e.target.value })} className={`${CONTROL} w-32`} />
            <button type="button" disabled={ocupado} onClick={() => hacer(async () => { await api.post('/mostrador/gastos', { concepto: gasto.concepto, monto: Number(gasto.monto) }); setGasto({ concepto: '', monto: '' }); }, 'Gasto anotado')}
              className="h-10 px-4 rounded-xl border border-border bg-white text-sm cursor-pointer disabled:opacity-50">Anotar gasto</button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-text">Plata contada en la caja
              <input type="number" min="0" inputMode="numeric" value={contado} onChange={(e) => setContado(e.target.value)} className={`${CONTROL} mt-1 font-normal w-44`} />
            </label>
            <button type="button" disabled={ocupado || contado === ''} onClick={() => hacer(async () => { const { data } = await api.post('/mostrador/turno/cerrar', { monto_contado: Number(contado) }); setCierre(data.cierre); setContado(''); })}
              className="h-10 px-4 rounded-xl bg-text text-bg text-sm font-semibold border-none cursor-pointer disabled:opacity-50">Cerrar turno</button>
          </div>
        </div>
      )}
    </section>
  );
}
