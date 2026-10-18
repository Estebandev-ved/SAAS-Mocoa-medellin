import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, Plus, RotateCcw, Link2, X } from 'lucide-react';
import { TIPOS, NODO_ANCHO, NODO_ALTO, nuevoNodo, flujoEjemplo } from '../components/flujos/catalogo';

// PROTOTIPO del constructor de flujos: solo front, los datos viven en este navegador (localStorage).
// Diseño y plan en docs/constructor-de-flujos.md. Todavía no se ejecuta nada en el bot.
const CLAVE = 'noma_prototipo_flujo';
const CONTROL = 'w-full bg-white border border-[#C9C9C9] rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-accent';

function cargar() {
  try {
    const f = JSON.parse(localStorage.getItem(CLAVE));
    if (f && Array.isArray(f.nodos) && Array.isArray(f.conexiones) && f.nodos.every((n) => TIPOS[n.tipo])) return f;
  } catch { /* sin datos guardados */ }
  return flujoEjemplo();
}

const NOMBRE_SALIDA = { default: '', si: 'Sí', no: 'No', 1: '1', 2: '2', 3: '3' };

function punto(nodo, salida) {
  const salidas = TIPOS[nodo.tipo].salidas;
  const i = Math.max(0, salidas.indexOf(salida));
  return { x: nodo.x + NODO_ANCHO, y: nodo.y + (NODO_ALTO * (i + 1)) / (salidas.length + 1) };
}

export default function FlujosPage() {
  const [flujo, setFlujo] = useState(cargar);
  const [sel, setSel] = useState(null);
  const [origen, setOrigen] = useState(null); // { id, salida } esperando un destino
  const arrastre = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(flujo)); } catch { /* sin almacenamiento */ }
  }, [flujo]);

  const nodoPorId = (id) => flujo.nodos.find((n) => n.id === id);
  const actualizarNodo = useCallback((id, cambios) => {
    setFlujo((f) => ({ ...f, nodos: f.nodos.map((n) => (n.id === id ? { ...n, ...cambios } : n)) }));
  }, []);

  const empezarArrastre = (e, nodo) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { id: nodo.id, dx: e.clientX - nodo.x, dy: e.clientY - nodo.y };
    setSel(nodo.id);
  };
  const moverArrastre = (e) => {
    const a = arrastre.current;
    if (!a) return;
    actualizarNodo(a.id, { x: Math.max(0, Math.round(e.clientX - a.dx)), y: Math.max(0, Math.round(e.clientY - a.dy)) });
  };
  const soltar = () => { arrastre.current = null; };

  const agregar = (tipo) => {
    const n = nuevoNodo(tipo, 60 + (flujo.nodos.length % 5) * 30, 360 + (flujo.nodos.length % 4) * 30);
    setFlujo((f) => ({ ...f, nodos: [...f.nodos, n] }));
    setSel(n.id);
  };

  const quitar = (id) => {
    setFlujo((f) => ({
      ...f,
      nodos: f.nodos.filter((n) => n.id !== id),
      conexiones: f.conexiones.filter((c) => c.desde !== id && c.hacia !== id),
    }));
    setSel(null);
  };

  const elegirSalida = (e, nodo, salida) => {
    e.stopPropagation();
    setOrigen((o) => (o && o.id === nodo.id && o.salida === salida ? null : { id: nodo.id, salida }));
  };
  const elegirEntrada = (e, nodo) => {
    e.stopPropagation();
    if (!origen || origen.id === nodo.id) return;
    setFlujo((f) => ({
      ...f,
      // una salida lleva a un solo destino: conectar de nuevo reemplaza
      conexiones: [...f.conexiones.filter((c) => !(c.desde === origen.id && c.salida === origen.salida)), { desde: origen.id, salida: origen.salida, hacia: nodo.id }],
    }));
    setOrigen(null);
  };
  const quitarConexion = (c) => setFlujo((f) => ({ ...f, conexiones: f.conexiones.filter((x) => x !== c) }));

  const reiniciar = () => { setFlujo(flujoEjemplo()); setSel(null); setOrigen(null); };

  const seleccionado = sel ? nodoPorId(sel) : null;
  const ancho = Math.max(1300, ...flujo.nodos.map((n) => n.x + NODO_ANCHO + 80));
  const alto = Math.max(520, ...flujo.nodos.map((n) => n.y + NODO_ALTO + 80));

  return (
    <div className="p-4 md:p-6 max-w-[1500px] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="font-head text-2xl text-text">Constructor de flujos</h1>
          <p className="text-sm text-muted max-w-2xl">
            Prototipo: arma conversaciones arrastrando pasos. Aún no se activa en tu bot; lo que armes se guarda solo en este navegador.
          </p>
        </div>
        <button type="button" onClick={reiniciar} className="h-11 px-4 rounded-xl border border-[#C9C9C9] bg-white text-sm text-text inline-flex items-center gap-2 cursor-pointer">
          <RotateCcw className="w-4 h-4" /> Volver al ejemplo
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3" aria-label="Agregar paso">
        {Object.entries(TIPOS).filter(([k]) => k !== 'disparador').map(([k, t]) => (
          <button key={k} type="button" onClick={() => agregar(k)}
            className="min-h-[44px] px-3 rounded-xl border border-[#C9C9C9] bg-white text-sm text-text inline-flex items-center gap-2 cursor-pointer hover:border-accent">
            <Plus className="w-4 h-4" style={{ color: t.color }} /> {t.etiqueta}
          </button>
        ))}
      </div>

      {origen && (
        <p className="text-sm text-accent mb-2 flex items-center gap-2" role="status">
          <Link2 className="w-4 h-4" /> Elige el paso al que llega esta salida (clic en su punto de entrada).
          <button type="button" onClick={() => setOrigen(null)} className="underline bg-transparent border-none cursor-pointer text-accent">Cancelar</button>
        </p>
      )}

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <div className="overflow-auto rounded-2xl border border-[#C9C9C9] bg-bg2" style={{ height: 'min(70vh, 640px)' }}>
          <div className="relative" style={{ width: ancho, height: alto }}
            onPointerMove={moverArrastre} onPointerUp={soltar} onClick={() => { setSel(null); setOrigen(null); }}>
            <svg width={ancho} height={alto} className="absolute inset-0" aria-hidden="true">
              {flujo.conexiones.map((c) => {
                const d = nodoPorId(c.desde); const h = nodoPorId(c.hacia);
                if (!d || !h) return null;
                const a = punto(d, c.salida); const bx = h.x; const by = h.y + NODO_ALTO / 2;
                const k = Math.max(40, Math.abs(bx - a.x) / 2);
                const trazo = `M${a.x},${a.y} C${a.x + k},${a.y} ${bx - k},${by} ${bx},${by}`;
                return (
                  <g key={`${c.desde}-${c.salida}`}>
                    <path d={trazo} fill="none" stroke="#94A3B8" strokeWidth="2" />
                    <path d={trazo} fill="none" stroke="transparent" strokeWidth="14"
                      style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); quitarConexion(c); }}>
                      <title>Clic para quitar esta conexión</title>
                    </path>
                  </g>
                );
              })}
            </svg>

            {flujo.nodos.map((n) => {
              const t = TIPOS[n.tipo];
              const Icono = t.icono;
              return (
                <div key={n.id} role="button" tabIndex={0} aria-label={`${t.etiqueta}: ${t.resumen(n.config)}`}
                  onPointerDown={(e) => empezarArrastre(e, n)} onClick={(e) => { e.stopPropagation(); setSel(n.id); }}
                  onKeyDown={(e) => { if (e.key === 'Delete' && n.tipo !== 'disparador') quitar(n.id); }}
                  className={`absolute bg-white rounded-xl shadow-sm cursor-grab select-none touch-none border-2 ${sel === n.id ? 'border-accent' : 'border-transparent'}`}
                  style={{ left: n.x, top: n.y, width: NODO_ANCHO, height: NODO_ALTO }}>
                  <div className="flex items-center gap-2 px-3 pt-2 text-xs font-semibold" style={{ color: t.color }}>
                    <Icono className="w-4 h-4" /> {t.etiqueta}
                  </div>
                  <p className="px-3 text-xs text-muted line-clamp-2 mt-1">{t.resumen(n.config)}</p>
                  {t.entrada && (
                    <button type="button" aria-label="Entrada" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => elegirEntrada(e, n)}
                      className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 bg-white cursor-pointer ${origen ? 'border-accent animate-pulse' : 'border-[#94A3B8]'}`} />
                  )}
                  {t.salidas.map((s, i) => (
                    <button key={s} type="button" aria-label={`Salida ${NOMBRE_SALIDA[s] || ''}`.trim()} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => elegirSalida(e, n, s)}
                      className={`absolute -right-3 w-6 h-6 rounded-full border-2 text-[10px] leading-none cursor-pointer ${origen && origen.id === n.id && origen.salida === s ? 'bg-accent text-white border-accent' : 'bg-white border-[#94A3B8] text-muted'}`}
                      style={{ top: `calc(${((i + 1) / (t.salidas.length + 1)) * 100}% - 12px)` }}>
                      {NOMBRE_SALIDA[s]}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="rounded-2xl border border-[#C9C9C9] bg-white p-4 h-fit" aria-label="Propiedades del paso">
          {!seleccionado ? (
            <p className="text-sm text-muted">Toca un paso para editarlo. Arrástralo para moverlo. Para conectar: toca un círculo de salida y luego el de entrada del siguiente paso. Toca una línea para quitarla.</p>
          ) : (
            <Propiedades nodo={seleccionado} onCambio={(config) => actualizarNodo(seleccionado.id, { config })} onQuitar={() => quitar(seleccionado.id)} onCerrar={() => setSel(null)} />
          )}
        </aside>
      </div>
    </div>
  );
}

function Campo({ etiqueta, children }) {
  return <label className="block mb-3 text-xs font-semibold text-text">{etiqueta}<div className="mt-1 font-normal">{children}</div></label>;
}

function Propiedades({ nodo, onCambio, onQuitar, onCerrar }) {
  const t = TIPOS[nodo.tipo];
  const c = nodo.config;
  const set = (k) => (e) => onCambio({ ...c, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const texto = (k, etiqueta, filas) => (
    <Campo etiqueta={etiqueta}>
      {filas ? <textarea rows={filas} maxLength={500} value={c[k] ?? ''} onChange={set(k)} className={CONTROL} />
        : <input maxLength={120} value={c[k] ?? ''} onChange={set(k)} className={CONTROL} />}
    </Campo>
  );
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-head text-lg text-text">{t.etiqueta}</h2>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="bg-transparent border-none cursor-pointer text-muted"><X className="w-4 h-4" /></button>
      </div>
      {nodo.tipo === 'disparador' && (<>
        <Campo etiqueta="¿Cuándo empieza?">
          <select value={c.modo} onChange={set('modo')} className={CONTROL}>
            <option value="palabra">Cuando escriben una palabra</option>
            <option value="primer_mensaje">En el primer mensaje del cliente</option>
          </select>
        </Campo>
        {c.modo === 'palabra' && texto('palabra', 'Palabra clave')}
      </>)}
      {nodo.tipo === 'mensaje' && (<>{texto('texto', 'Mensaje', 4)}<p className="text-xs text-muted">Usa {'{nombre}'} para el primer nombre del cliente.</p></>)}
      {nodo.tipo === 'espera' && (<>
        <Campo etiqueta="Cantidad"><input type="number" min="1" max="1440" value={c.cantidad} onChange={set('cantidad')} className={CONTROL} /></Campo>
        <Campo etiqueta="Unidad"><select value={c.unidad} onChange={set('unidad')} className={CONTROL}><option>minutos</option><option>horas</option><option>días</option></select></Campo>
      </>)}
      {nodo.tipo === 'opciones' && (<>{texto('texto', 'Pregunta', 2)}{texto('o1', 'Opción 1')}{texto('o2', 'Opción 2')}{texto('o3', 'Opción 3')}</>)}
      {nodo.tipo === 'pregunta' && (<>{texto('texto', 'Pregunta', 2)}{texto('campo', 'Guardar la respuesta en')}</>)}
      {nodo.tipo === 'etiqueta' && (<>
        <Campo etiqueta="Acción"><select value={c.accion} onChange={set('accion')} className={CONTROL}><option value="poner">Poner etiqueta</option><option value="quitar">Quitar etiqueta</option></select></Campo>
        {texto('nombre', 'Etiqueta')}
      </>)}
      {nodo.tipo === 'condicion' && texto('valor', 'Si el cliente tiene la etiqueta')}
      {nodo.tipo === 'ia' && texto('instruccion', 'Qué debe hacer la IA', 4)}
      {nodo.tipo === 'pedido' && (<>
        <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={!!c.cobrar} onChange={set('cobrar')} /> Cobrar al terminar</label>
        <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={!!c.cupon} onChange={set('cupon')} /> Pedir cupón</label>
      </>)}
      {nodo.tipo === 'asesor' && texto('aviso', 'Mensaje al cliente', 3)}
      {nodo.tipo !== 'disparador' && (
        <button type="button" onClick={onQuitar} className="mt-2 h-11 px-4 rounded-xl border border-danger/40 text-danger bg-white text-sm inline-flex items-center gap-2 cursor-pointer">
          <Trash2 className="w-4 h-4" /> Quitar paso
        </button>
      )}
    </div>
  );
}
