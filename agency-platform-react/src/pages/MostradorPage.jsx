import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, Minus, Trash2, Loader2, Banknote, Smartphone, CreditCard, ArrowLeftRight, Receipt, Undo2, Lock } from 'lucide-react';
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
        await Promise.all([cargarVentas(), cargarTurno()]);
      } catch (e) {
        if (e?.response?.status === 403) setSinAcceso(true); else aviso('error', mensajeError(e, 'cargar la caja'));
      } finally { setCargando(false); }
    })();
  }, [cargarVentas, cargarTurno]);

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
    setCobrando(true);
    try {
      const { data } = await api.post('/mostrador/ventas', {
        items: lineas.map((l) => ({ producto_id: l.p.id, cantidad: l.cantidad })),
        metodo_pago: metodo, recibido: metodo === 'efectivo' && recibido !== '' ? Number(recibido) : undefined,
      });
      const v = data.venta;
      aviso('success', `Venta ${v.numero} cobrada: ${pesos(v.total)}${v.cambio ? ` · devuelve ${pesos(v.cambio)}` : ''}`);
      setCarrito({}); setRecibido('');
      const { data: pr } = await api.get('/mostrador/productos');
      setProductos(Array.isArray(pr?.productos) ? pr.productos : []);
      await Promise.all([cargarVentas(), cargarTurno()]);
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
      await Promise.all([cargarVentas(), cargarTurno()]);
    } catch (e) { aviso('error', mensajeError(e, 'anular la venta')); }
  };

  if (cargando) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>;
  if (sinAcceso) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        <Lock className="w-8 h-8 mx-auto text-muted mb-3" />
        <h1 className="font-head text-xl text-text mb-2">Venta de mostrador</h1>
        <p className="text-sm text-muted">Cobrar en el local con tu inventario viene en los planes Inicial, Profesional y Empresarial. El plan Emprendedor usa la Caja.</p>
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
          <button type="button" onClick={cobrar} disabled={!lineas.length || cobrando}
            className="w-full h-12 rounded-xl bg-accent text-white font-semibold border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {cobrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}Cobrar {pesos(total)}
          </button>
        </aside>
      </div>

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
