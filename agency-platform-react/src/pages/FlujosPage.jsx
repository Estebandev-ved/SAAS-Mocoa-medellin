import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, Plus, Link2, X, Save, Power, Loader2, FilePlus2, Undo2, Copy, LayoutTemplate, ZoomIn, ZoomOut } from 'lucide-react';
import api from '../services/api';
import Toast from '../components/Toast';
import SimuladorFlujo from '../components/flujos/SimuladorFlujo';
import MetricasFlujo from '../components/flujos/MetricasFlujo';
import { useConfirm } from '../context/ConfirmContext';
import { mensajeError } from '../utils/errores';
import { TIPOS, NODO_ANCHO, NODO_ALTO, MODOS_DISPARADOR, TIPOS_CONDICION, esEvento, nuevoNodo, flujoEjemplo } from '../components/flujos/catalogo';
import PlantillasFlujo from '../components/flujos/PlantillasFlujo';

// Constructor de flujos (diseño y plan en docs/constructor-de-flujos.md). Los flujos se guardan en la API
// (/api/flujos) y, una vez encendidos, el bot los ejecuta cuando el cliente escribe la palabra clave.
const CONTROL = 'w-full bg-white border border-[#C9C9C9] rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-accent';

// Flujo nuevo: solo el disparador, para que el dueño arme el resto (o parta del ejemplo).
const flujoVacio = () => ({
  nodos: [{ id: 'disparador', tipo: 'disparador', x: 40, y: 60, config: { ...TIPOS.disparador.config, palabra: '' } }],
  conexiones: [],
});

const NOMBRE_SALIDA = { default: '', si: 'Sí', no: 'No', 1: '1', 2: '2', 3: '3' };

function punto(nodo, salida) {
  const salidas = TIPOS[nodo.tipo].salidas;
  const i = Math.max(0, salidas.indexOf(salida));
  return { x: nodo.x + NODO_ANCHO, y: nodo.y + (NODO_ALTO * (i + 1)) / (salidas.length + 1) };
}

export default function FlujosPage() {
  const confirmar = useConfirm();
  const [lista, setLista] = useState([]);
  const [limite, setLimite] = useState(null);
  const [id, setId] = useState(null);              // null = flujo aún sin guardar
  const [nombre, setNombre] = useState('Mi primer flujo');
  const [activo, setActivo] = useState(false);
  const [flujo, setFlujo] = useState(flujoEjemplo);
  const [base, setBase] = useState('');            // foto de lo último guardado, para saber si hay cambios
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [sel, setSel] = useState(null);
  const [origen, setOrigen] = useState(null); // { id, salida } esperando un destino
  const arrastre = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [verPlantillas, setVerPlantillas] = useState(false);
  // Deshacer: pila de estados anteriores del lienzo (se guarda antes de cada cambio; al escribir en un campo, una vez por ráfaga).
  const pasado = useRef([]);
  const ultimoGuardadoMs = useRef(0);
  const [puedeDeshacer, setPuedeDeshacer] = useState(false);
  const guardarPaso = useCallback((actual, soloSiPasoTiempo = false) => {
    const ahora = Date.now();
    if (soloSiPasoTiempo && ahora - ultimoGuardadoMs.current < 1500) { ultimoGuardadoMs.current = ahora; return; }
    ultimoGuardadoMs.current = ahora;
    pasado.current = [...pasado.current.slice(-49), actual];
    setPuedeDeshacer(true);
  }, []);
  const limpiarHistorial = () => { pasado.current = []; setPuedeDeshacer(false); };

  const foto = (n, f) => JSON.stringify({ n, f });
  const sucio = foto(nombre, flujo) !== base;
  // Cambios que valen la pena proteger: en un flujo guardado, cualquier diferencia; en uno nuevo, solo si ya se tocó algo.
  const hayCambios = sucio && (id !== null || puedeDeshacer);

  const abrir = useCallback((f) => {
    setId(f.id); setNombre(f.nombre); setActivo(f.activo); setFlujo(f.definicion);
    setBase(foto(f.nombre, f.definicion)); setSel(null); setOrigen(null);
    pasado.current = []; setPuedeDeshacer(false);
  }, []);

  const cargarLista = useCallback(async (abrirId) => {
    try {
      const { data } = await api.get('/flujos');
      setLista(data.flujos); setLimite(data.limite);
      const f = data.flujos.find((x) => x.id === abrirId) || (abrirId === undefined ? data.flujos[0] : null);
      if (f) abrir(f);
      else if (abrirId === undefined) { setId(null); setNombre('Mi primer flujo'); setActivo(false); setFlujo(flujoEjemplo()); setBase(''); }
    } catch (e) {
      setAviso({ type: 'error', message: mensajeError(e, 'cargar tus flujos') });
    } finally {
      setCargando(false);
    }
  }, [abrir]);

  useEffect(() => { cargarLista(); }, [cargarLista]);

  // Aviso del navegador al cerrar con cambios sin guardar
  useEffect(() => {
    if (!sucio) return undefined;
    const antes = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [sucio]);

  const guardar = async (encender) => {
    setOcupado(true);
    try {
      const cuerpo = { nombre: nombre.trim(), definicion: flujo, activo: encender ?? activo };
      let idFinal = id;
      if (id) await api.put(`/flujos/${id}`, cuerpo);
      else idFinal = (await api.post('/flujos', cuerpo)).data.id;
      await cargarLista(idFinal);
      setAviso({ type: 'success', message: cuerpo.activo ? 'Flujo guardado y encendido' : 'Flujo guardado' });
    } catch (e) {
      setAviso({ type: 'error', message: e.response?.data?.error || mensajeError(e, 'guardar el flujo') });
    } finally {
      setOcupado(false);
    }
  };

  const alternarActivo = async () => {
    if (sucio || !id) { await guardar(!activo); return; }
    setOcupado(true);
    try {
      await api.patch(`/flujos/${id}/activo`, { activo: !activo });
      setActivo(!activo);
      setLista((l) => l.map((f) => (f.id === id ? { ...f, activo: !activo } : f)));
      setAviso({ type: 'success', message: !activo ? 'Flujo encendido: ya responde en WhatsApp' : 'Flujo apagado' });
    } catch (e) {
      setAviso({ type: 'error', message: e.response?.data?.error || mensajeError(e, 'cambiar el estado') });
    } finally {
      setOcupado(false);
    }
  };

  const borrar = async () => {
    if (!id) { cargarLista(); return; }
    const ok = await confirmar({ titulo: '¿Borrar este flujo?', mensaje: `"${nombre}" dejará de responder y no se puede recuperar.`, boton: 'Borrar', peligro: true });
    if (!ok) return;
    setOcupado(true);
    try {
      await api.delete(`/flujos/${id}`);
      await cargarLista();
      setAviso({ type: 'success', message: 'Flujo borrado' });
    } catch (e) {
      setAviso({ type: 'error', message: mensajeError(e, 'borrar el flujo') });
    } finally {
      setOcupado(false);
    }
  };

  const nuevoFlujo = async (conEjemplo) => {
    if (hayCambios) {
      const ok = await confirmar({ titulo: '¿Descartar los cambios?', mensaje: 'Tienes cambios sin guardar en este flujo.', boton: 'Descartar', peligro: true });
      if (!ok) return;
    }
    setId(null); setActivo(false); setNombre(conEjemplo ? 'Promo por WhatsApp' : 'Flujo nuevo');
    setFlujo(conEjemplo ? flujoEjemplo() : flujoVacio()); setBase(''); setSel(null); setOrigen(null);
    limpiarHistorial();
  };

  // Arranca desde una plantilla (queda sin guardar: el dueño la ajusta y luego guarda).
  const usarPlantilla = async (plantilla) => {
    if (hayCambios) {
      const ok = await confirmar({ titulo: '¿Descartar los cambios?', mensaje: 'Tienes cambios sin guardar en este flujo.', boton: 'Descartar', peligro: true });
      if (!ok) return;
    }
    setId(null); setActivo(false); setNombre(plantilla.nombre); setFlujo(JSON.parse(JSON.stringify(plantilla.definicion)));
    setBase(''); setSel(null); setOrigen(null); limpiarHistorial(); setVerPlantillas(false);
    setAviso({ type: 'success', message: 'Plantilla lista: cambia los textos a tu gusto y pulsa Guardar' });
  };

  // Copia el flujo que ves (con sus cambios) como uno nuevo sin guardar: sirve para probar variantes.
  const duplicar = () => {
    setId(null); setActivo(false); setNombre(`${nombre} (copia)`.slice(0, 100)); setBase(''); setSel(null); setOrigen(null);
    limpiarHistorial();
    setAviso({ type: 'success', message: 'Copia lista: ajústala y pulsa Guardar' });
  };

  const cambiarDeFlujo = async (nuevoId) => {
    const f = lista.find((x) => x.id === Number(nuevoId));
    if (!f || f.id === id) return;
    if (hayCambios) {
      const ok = await confirmar({ titulo: '¿Descartar los cambios?', mensaje: 'Tienes cambios sin guardar en este flujo.', boton: 'Descartar', peligro: true });
      if (!ok) return;
    }
    abrir(f);
  };

  const nodoPorId = (id) => flujo.nodos.find((n) => n.id === id);
  const actualizarNodo = useCallback((id, cambios) => {
    setFlujo((f) => ({ ...f, nodos: f.nodos.map((n) => (n.id === id ? { ...n, ...cambios } : n)) }));
  }, []);

  const empezarArrastre = (e, nodo) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { id: nodo.id, cx: e.clientX, cy: e.clientY, x0: nodo.x, y0: nodo.y, antes: flujo };
    setSel(nodo.id);
  };
  const moverArrastre = (e) => {
    const a = arrastre.current;
    if (!a) return;
    // El lienzo puede estar con zoom: el movimiento del puntero se convierte a coordenadas del lienzo.
    actualizarNodo(a.id, { x: Math.max(0, Math.round(a.x0 + (e.clientX - a.cx) / zoom)), y: Math.max(0, Math.round(a.y0 + (e.clientY - a.cy) / zoom)) });
  };
  const soltar = () => {
    const a = arrastre.current;
    arrastre.current = null;
    // Solo cuenta como cambio si el paso realmente se movió.
    if (a && JSON.stringify(a.antes.nodos) !== JSON.stringify(flujo.nodos)) guardarPaso(a.antes);
  };

  const deshacer = useCallback(() => {
    const anterior = pasado.current[pasado.current.length - 1];
    if (!anterior) return;
    pasado.current = pasado.current.slice(0, -1);
    setPuedeDeshacer(pasado.current.length > 0);
    setFlujo(anterior); setSel(null); setOrigen(null);
  }, []);

  // Ctrl/Cmd+Z deshace, salvo que se esté escribiendo en un campo (ahí deshace el texto del propio campo)
  useEffect(() => {
    const alTeclear = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      deshacer();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [deshacer]);

  const agregar = (tipo) => {
    guardarPaso(flujo);
    const n = nuevoNodo(tipo, 60 + (flujo.nodos.length % 5) * 30, 360 + (flujo.nodos.length % 4) * 30);
    setFlujo((f) => ({ ...f, nodos: [...f.nodos, n] }));
    setSel(n.id);
  };

  const quitar = (id) => {
    guardarPaso(flujo);
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
    guardarPaso(flujo);
    setFlujo((f) => ({
      ...f,
      // una salida lleva a un solo destino: conectar de nuevo reemplaza
      conexiones: [...f.conexiones.filter((c) => !(c.desde === origen.id && c.salida === origen.salida)), { desde: origen.id, salida: origen.salida, hacia: nodo.id }],
    }));
    setOrigen(null);
  };
  const quitarConexion = (c) => { guardarPaso(flujo); setFlujo((f) => ({ ...f, conexiones: f.conexiones.filter((x) => x !== c) })); };

  const seleccionado = sel ? nodoPorId(sel) : null;
  const ancho = Math.max(1300, ...flujo.nodos.map((n) => n.x + NODO_ANCHO + 80));
  const alto = Math.max(520, ...flujo.nodos.map((n) => n.y + NODO_ALTO + 80));

  return (
    <div className="p-4 md:p-6 max-w-[1500px] mx-auto">
      {aviso && <Toast type={aviso.type} message={aviso.message} onClose={() => setAviso(null)} />}
      <div className="mb-4">
        <h1 className="font-head text-2xl text-text">Flujos</h1>
        <p className="text-sm text-muted max-w-2xl">
          Arma conversaciones paso a paso: cuando un cliente escriba la palabra clave, tu bot sigue el flujo. Si el flujo no entiende, responde la IA de siempre.
        </p>
      </div>

      {cargando ? (
        <div className="py-16 flex justify-center text-muted"><Loader2 className="w-6 h-6 animate-spin" aria-label="Cargando" /></div>
      ) : (<>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        {lista.length > 0 && (
          <label className="text-xs font-semibold text-text">Tus flujos
            <select value={id ?? ''} onChange={(e) => cambiarDeFlujo(e.target.value)} className={`${CONTROL} mt-1 min-h-[44px] min-w-[180px]`}>
              {id === null && <option value="">(sin guardar)</option>}
              {lista.map((f) => <option key={f.id} value={f.id}>{f.nombre}{f.activo ? ' · encendido' : ''}</option>)}
            </select>
          </label>
        )}
        <label className="text-xs font-semibold text-text flex-1 min-w-[180px]">Nombre
          <input value={nombre} maxLength={100} onChange={(e) => setNombre(e.target.value)} className={`${CONTROL} mt-1 min-h-[44px]`} />
        </label>
        <button type="button" onClick={() => nuevoFlujo(false)} disabled={ocupado || (limite !== null && lista.length >= limite)}
          title={limite !== null && lista.length >= limite ? `Tu plan permite ${limite} flujos` : undefined}
          className="h-11 px-4 rounded-xl border border-[#C9C9C9] bg-white text-sm text-text inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          <FilePlus2 className="w-4 h-4" /> Nuevo
        </button>
        <button type="button" onClick={() => setVerPlantillas(true)} disabled={ocupado || (limite !== null && lista.length >= limite)}
          className="h-11 px-4 rounded-xl border border-accent text-accent bg-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          <LayoutTemplate className="w-4 h-4" /> Plantillas
        </button>
        <button type="button" onClick={() => nuevoFlujo(true)} disabled={ocupado || (limite !== null && lista.length >= limite)}
          className="h-11 px-4 rounded-xl border border-[#C9C9C9] bg-white text-sm text-text cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          Partir del ejemplo
        </button>
        <button type="button" onClick={deshacer} disabled={!puedeDeshacer} aria-label="Deshacer el último cambio" title="Deshacer (Ctrl+Z)"
          className="h-11 w-11 rounded-xl border border-[#C9C9C9] bg-white text-text inline-flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          <Undo2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={duplicar} disabled={ocupado || (limite !== null && lista.length >= limite)} aria-label="Duplicar flujo" title="Duplicar como flujo nuevo"
          className="h-11 w-11 rounded-xl border border-[#C9C9C9] bg-white text-text inline-flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          <Copy className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => guardar()} disabled={ocupado || !nombre.trim() || (!sucio && id !== null)}
          className="h-11 px-5 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold inline-flex items-center gap-2 border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar{sucio ? ' *' : ''}
        </button>
        <button type="button" onClick={alternarActivo} disabled={ocupado || !nombre.trim()} aria-pressed={activo}
          className={`h-11 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2 border cursor-pointer disabled:opacity-50 ${activo ? 'bg-success/10 text-success border-success/40' : 'bg-white text-text border-[#C9C9C9]'}`}>
          <Power className="w-4 h-4" /> {activo ? 'Encendido' : 'Apagado'}
        </button>
        <button type="button" onClick={borrar} disabled={ocupado} aria-label="Borrar flujo"
          className="h-11 w-11 rounded-xl border border-danger/40 text-danger bg-white inline-flex items-center justify-center cursor-pointer disabled:opacity-50">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {limite !== null && <p className="text-xs text-muted mb-3">Tu plan incluye hasta {limite} flujos ({lista.length} en uso). Para encender un flujo debe estar completo: con palabra clave y todos los pasos conectados.</p>}

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
        <div className="relative">
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-xl bg-white/90 border border-[#C9C9C9] p-1" role="group" aria-label="Zoom del lienzo">
          <button type="button" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))} disabled={zoom <= 0.5} aria-label="Alejar"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-transparent border-none cursor-pointer text-text disabled:opacity-40"><ZoomOut className="w-4 h-4" /></button>
          <button type="button" onClick={() => setZoom(1)} aria-label="Zoom al 100%" className="h-9 px-2 text-xs rounded-lg bg-transparent border-none cursor-pointer text-text min-w-[3rem]">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))} disabled={zoom >= 1.5} aria-label="Acercar"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-transparent border-none cursor-pointer text-text disabled:opacity-40"><ZoomIn className="w-4 h-4" /></button>
        </div>
        <div className="overflow-auto rounded-2xl border border-[#C9C9C9] bg-bg2" style={{ height: 'min(70vh, 640px)' }}>
          <div style={{ width: ancho * zoom, height: alto * zoom }}>
          <div className="relative" style={{ width: ancho, height: alto, transform: `scale(${zoom})`, transformOrigin: '0 0' }}
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
        </div>
        </div>

        <aside className="rounded-2xl border border-[#C9C9C9] bg-white p-4 h-fit" aria-label="Propiedades del paso">
          {!seleccionado ? (
            <p className="text-sm text-muted">Toca un paso para editarlo. Arrástralo para moverlo. Para conectar: toca un círculo de salida y luego el de entrada del siguiente paso. Toca una línea para quitarla.</p>
          ) : (
            <Propiedades nodo={seleccionado} otrosFlujos={lista.filter((f) => f.id !== id)} onCambio={(config) => { guardarPaso(flujo, true); actualizarNodo(seleccionado.id, { config }); }} onQuitar={() => quitar(seleccionado.id)} onCerrar={() => setSel(null)} />
          )}
        </aside>
      </div>
      {verPlantillas && <PlantillasFlujo onElegir={usarPlantilla} onCerrar={() => setVerPlantillas(false)} />}
      <div className="mt-4 grid lg:grid-cols-2 gap-4 items-start">
        <SimuladorFlujo definicion={flujo} />
        <MetricasFlujo flujoId={id} nodos={flujo.nodos} />
      </div>
      </>)}
    </div>
  );
}

function Campo({ etiqueta, children }) {
  return <label className="block mb-3 text-xs font-semibold text-text">{etiqueta}<div className="mt-1 font-normal">{children}</div></label>;
}

function Propiedades({ nodo, otrosFlujos = [], onCambio, onQuitar, onCerrar }) {
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
            {MODOS_DISPARADOR.map((m) => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
          </select>
        </Campo>
        {c.modo === 'palabra' && texto('palabra', 'Palabra clave')}
        {c.modo === 'cliente_inactivo' && (
          <Campo etiqueta="Días sin comprar"><input type="number" min="1" max="365" value={c.dias ?? 30} onChange={set('dias')} className={CONTROL} /></Campo>
        )}
        {esEvento(c.modo) && (
          <p className="text-xs text-muted mb-3">Este flujo arranca solo, sin que el cliente escriba. Solo le escribe a quien aceptó recibir mensajes de marketing, con un tope diario para cuidar tu número.</p>
        )}
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
      {nodo.tipo === 'condicion' && (<>
        <Campo etiqueta="Pregunta">
          <select value={c.tipo || 'etiqueta'} onChange={set('tipo')} className={CONTROL}>
            {TIPOS_CONDICION.map((tc) => <option key={tc.valor} value={tc.valor}>{tc.etiqueta}</option>)}
          </select>
        </Campo>
        {(c.tipo || 'etiqueta') === 'etiqueta' && texto('valor', 'Nombre de la etiqueta')}
        {c.tipo === 'dato' && (<>{texto('campo', 'Dato (el campo de una pregunta anterior)')}{texto('valor', 'Contiene')}</>)}
        {c.tipo === 'gastado' && <Campo etiqueta="Total gastado mínimo ($)"><input type="number" min="0" value={c.minimo ?? 0} onChange={set('minimo')} className={CONTROL} /></Campo>}
        {c.tipo === 'pedidos' && <Campo etiqueta="Pedidos mínimos"><input type="number" min="0" value={c.minimo ?? 1} onChange={set('minimo')} className={CONTROL} /></Campo>}
        {c.tipo === 'stock' && (<>
          <SelectorProducto valor={c.producto_id} onCambio={(v) => onCambio({ ...c, producto_id: v })} />
          <Campo etiqueta="Unidades mínimas"><input type="number" min="1" value={c.minimo ?? 1} onChange={set('minimo')} className={CONTROL} /></Campo>
          <p className="text-xs text-muted mb-3">Solo cuenta si ese producto tiene activado "Controlar inventario".</p>
        </>)}
        <p className="text-xs text-muted mb-3">La salida <b>Sí</b> sigue si se cumple y la salida <b>No</b> si no.</p>
      </>)}
      {nodo.tipo === 'info_pago' && (<>{texto('nota', 'Nota después de los métodos de pago', 3)}<p className="text-xs text-muted mb-3">Envía los números de Nequi y Bancolombia que pusiste en Ajustes.</p></>)}
      {nodo.tipo === 'saltar' && (
        <Campo etiqueta="Flujo al que continúa">
          <select value={c.flujo_id || ''} onChange={(e) => onCambio({ ...c, flujo_id: Number(e.target.value) || 0 })} className={CONTROL}>
            <option value="">Elige un flujo guardado…</option>
            {otrosFlujos.map((f) => <option key={f.id} value={f.id}>{f.nombre}{f.activo ? '' : ' (apagado)'}</option>)}
          </select>
          <p className="text-xs text-muted mt-1">El otro flujo debe estar encendido para que funcione.</p>
        </Campo>
      )}
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

// Lista de productos del negocio para las condiciones de stock.
function SelectorProducto({ valor, onCambio }) {
  const [productos, setProductos] = useState(null);
  useEffect(() => {
    let vivo = true;
    api.get('/productos', { params: { activo: 'true', limit: 200 } })
      .then((r) => { if (vivo) setProductos(r.data.productos || []); })
      .catch(() => { if (vivo) setProductos([]); });
    return () => { vivo = false; };
  }, []);
  return (
    <Campo etiqueta="Producto">
      <select value={valor || ''} onChange={(e) => onCambio(Number(e.target.value) || 0)} className={CONTROL}>
        <option value="">{productos === null ? 'Cargando…' : 'Elige un producto…'}</option>
        {(productos || []).map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.controla_stock ? ` (${p.stock} en stock)` : ''}</option>)}
      </select>
    </Campo>
  );
}
