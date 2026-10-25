import { useEffect, useRef, useState } from 'react';
import { X, Loader2, ArrowDownToLine, ArrowUpFromLine, FileSpreadsheet, Download } from 'lucide-react';
import api from '../../services/api';
import usePreferencias from '../../hooks/usePreferencias';
import { formatearFecha } from '../../utils/preferencias';

const CONTROL = 'w-full bg-bg border border-border rounded-xl px-4 py-3 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent/50';

// Ventana modal sencilla: se cierra con Escape o tocando fuera; en celular sale desde abajo.
function Modal({ titulo, onCerrar, children, ancho = 'sm:max-w-lg' }) {
  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={titulo} onClick={onCerrar}>
      <div className={`bg-bg2 w-full ${ancho} max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 border border-border`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="font-head text-lg text-text">{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="h-11 w-11 -mt-2 -mr-2 inline-flex items-center justify-center rounded-xl bg-transparent border-none cursor-pointer text-muted"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Suma o resta unidades de un producto (con motivo). Siempre queda en el historial. */
export function AjustarStock({ producto, onListo, onCerrar }) {
  const [operacion, setOperacion] = useState('agregar');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const unidades = Number(cantidad);
  const valido = Number.isInteger(unidades) && unidades > 0;
  const resultado = valido ? Number(producto.stock) + (operacion === 'agregar' ? unidades : -unidades) : null;

  const guardar = async (e) => {
    e.preventDefault();
    if (!valido) return;
    setGuardando(true);
    setError('');
    try {
      const { data } = await api.patch(`/productos/${producto.id}/stock`, { operacion, cantidad: unidades, motivo: motivo.trim() || undefined });
      onListo(data.stock_nuevo);
    } catch (err) {
      setError(err.response?.data?.error === 'Stock insuficiente'
        ? `No alcanza: solo hay ${err.response.data.stock_actual} unidades.`
        : (err.response?.data?.error || 'No se pudo ajustar el stock'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal titulo={`Ajustar stock · ${producto.nombre}`} onCerrar={onCerrar}>
      <p className="text-sm text-muted mb-4">Hoy hay <b className="text-text">{producto.stock}</b> unidades. Cada ajuste queda registrado en el historial.</p>
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de ajuste">
          {[['agregar', 'Entró mercancía', ArrowDownToLine], ['restar', 'Salió / se dañó', ArrowUpFromLine]].map(([valor, etiqueta, Icono]) => (
            <button key={valor} type="button" role="radio" aria-checked={operacion === valor} onClick={() => setOperacion(valor)}
              className={`min-h-[48px] rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer ${operacion === valor ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-bg text-text'}`}>
              <Icono className="w-4 h-4" /> {etiqueta}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-xs text-muted mb-1" htmlFor="aj-cantidad">Cantidad</label>
          <input id="aj-cantidad" type="number" min="1" step="1" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={CONTROL} placeholder="Ej: 10" autoFocus />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1" htmlFor="aj-motivo">Motivo (opcional)</label>
          <input id="aj-motivo" maxLength={160} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={CONTROL} placeholder={operacion === 'agregar' ? 'Ej: Compra a proveedor' : 'Ej: Producto dañado'} />
        </div>
        {valido && (
          <p className={`text-sm ${resultado < 0 ? 'text-danger-text' : 'text-muted'}`} role="status">
            {resultado < 0 ? `No alcanza: solo hay ${producto.stock}.` : `Quedarán ${resultado} unidades.`}
          </p>
        )}
        {error && <p className="text-sm text-danger-text" role="alert">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCerrar} className="h-11 px-4 text-muted text-sm rounded-xl border border-border bg-transparent cursor-pointer">Cancelar</button>
          <button type="submit" disabled={!valido || resultado < 0 || guardando} className="h-11 px-6 inline-flex items-center gap-2 bg-accent text-white text-sm font-semibold rounded-xl border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar ajuste
          </button>
        </div>
      </form>
    </Modal>
  );
}

const ETIQUETA_TIPO = { entrada: 'Entrada', salida: 'Venta', ajuste: 'Ajuste', devolucion: 'Devolución' };

/** Historial de movimientos de un producto (lo último primero). */
export function HistorialStock({ producto, onCerrar }) {
  const prefs = usePreferencias();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    api.get(`/productos/${producto.id}/movimientos`, { params: { limit: 100 } })
      .then((r) => { if (vivo) setDatos(r.data); })
      .catch(() => { if (vivo) setError('No se pudo cargar el historial.'); });
    return () => { vivo = false; };
  }, [producto.id]);

  return (
    <Modal titulo={`Historial · ${producto.nombre}`} onCerrar={onCerrar} ancho="sm:max-w-2xl">
      {!datos && !error && <div className="py-8 flex justify-center text-muted"><Loader2 className="w-6 h-6 animate-spin" aria-label="Cargando" /></div>}
      {error && <p className="text-sm text-danger-text" role="alert">{error}</p>}
      {datos && datos.movimientos.length === 0 && (
        <p className="text-sm text-muted py-4">Todavía no hay movimientos. Cuando entre mercancía, se venda o ajustes el stock, aparecerá aquí.</p>
      )}
      {datos && datos.movimientos.length > 0 && (
        <ul className="divide-y divide-border">
          {datos.movimientos.map((m) => (
            <li key={m.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="text-text font-semibold">{ETIQUETA_TIPO[m.tipo] || m.tipo}{m.motivo ? <span className="font-normal text-muted"> · {m.motivo}</span> : null}</p>
                <p className="text-xs text-muted">{formatearFecha(m.created_at, { hora: true }, prefs)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-mono font-bold ${m.cantidad > 0 ? 'text-success' : 'text-danger-text'}`}>{m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}</p>
                <p className="text-xs text-muted">quedan {m.stock_resultante}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Descarga el CSV de productos (necesita el token, por eso no es un simple enlace). */
export async function descargarProductosCsv() {
  const r = await api.get('/productos/exportar', { responseType: 'blob' });
  const url = URL.createObjectURL(r.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'productos.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const PLANTILLA_CSV = 'nombre;sku;precio;stock;stock_minimo;categoria;descripcion;controla_stock\r\nCamiseta básica;CAM-001;35000;20;5;Ropa;Camiseta de algodón;si\r\nServicio de corte;;25000;;;Servicios;Corte de cabello;no\r\n';

export function descargarPlantillaCsv() {
  const blob = new Blob([`﻿${PLANTILLA_CSV}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-productos.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const ACCION = {
  crear: { texto: 'Se crea', clase: 'bg-success/10 text-success' },
  actualizar: { texto: 'Se actualiza', clase: 'bg-info/10 text-info' },
  error: { texto: 'Con error', clase: 'bg-danger/10 text-danger-text' },
};

/** Importar productos desde un CSV: elige el archivo → vista previa por fila → confirmar. */
export function ImportarProductos({ onListo, onCerrar }) {
  const entrada = useRef(null);
  const [csv, setCsv] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [vista, setVista] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const elegir = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setError(''); setVista(null); setResultado(null);
    if (archivo.size > 1024 * 1024) { setError('El archivo es demasiado grande (máx. 1 MB).'); return; }
    const texto = await archivo.text();
    setCsv(texto);
    setNombreArchivo(archivo.name);
    setCargando(true);
    try {
      const { data } = await api.post('/productos/importar', { csv: texto });
      setVista(data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo leer el archivo.');
    } finally {
      setCargando(false);
    }
  };

  const aplicar = async () => {
    setAplicando(true);
    setError('');
    try {
      const { data } = await api.post('/productos/importar', { csv, aplicar: true });
      setResultado(data);
      onListo();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo importar.');
    } finally {
      setAplicando(false);
    }
  };

  const r = vista?.resumen;
  const nada = r && r.crear + r.actualizar === 0;

  return (
    <Modal titulo="Importar productos desde Excel" onCerrar={onCerrar} ancho="sm:max-w-3xl">
      {resultado ? (
        <div className="space-y-3">
          <p className="text-sm text-text" role="status">
            Listo: <b>{resultado.creados}</b> creados y <b>{resultado.actualizados}</b> actualizados.
            {resultado.errores.length > 0 && <> No se pudieron guardar {resultado.errores.length}: </>}
          </p>
          {resultado.errores.length > 0 && (
            <ul className="text-xs text-danger-text list-disc pl-5">{resultado.errores.map((e) => <li key={e.numero}>Fila {e.numero}: {e.error}</li>)}</ul>
          )}
          <div className="flex justify-end"><button type="button" onClick={onCerrar} className="h-11 px-6 bg-accent text-white text-sm font-semibold rounded-xl border-none cursor-pointer">Cerrar</button></div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Sube un archivo <b>.csv</b> (en Excel: Guardar como → CSV). La primera fila son los títulos: <code>nombre</code>, <code>precio</code>, <code>stock</code>, <code>sku</code>, <code>categoria</code>…
            Si el producto ya existe (mismo código o nombre) se actualiza; si no, se crea. Nada se guarda hasta que confirmes.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => entrada.current?.click()} className="h-11 px-4 inline-flex items-center gap-2 bg-accent text-white text-sm font-semibold rounded-xl border-none cursor-pointer">
              <FileSpreadsheet className="w-4 h-4" /> {nombreArchivo ? 'Elegir otro archivo' : 'Elegir archivo CSV'}
            </button>
            <button type="button" onClick={descargarPlantillaCsv} className="h-11 px-4 inline-flex items-center gap-2 bg-transparent text-text text-sm rounded-xl border border-border cursor-pointer">
              <Download className="w-4 h-4" /> Descargar plantilla
            </button>
            <input ref={entrada} type="file" accept=".csv,text/csv" className="hidden" onChange={elegir} />
          </div>
          {nombreArchivo && <p className="text-xs text-muted">Archivo: {nombreArchivo}</p>}
          {cargando && <div className="py-4 flex items-center gap-2 text-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Revisando el archivo…</div>}
          {error && <p className="text-sm text-danger-text" role="alert">{error}</p>}

          {r && (
            <>
              <p className="text-sm text-text" role="status">
                Se crearán <b>{r.crear}</b>, se actualizarán <b>{r.actualizar}</b>{r.errores > 0 && <> y <b className="text-danger-text">{r.errores}</b> filas tienen errores y se saltarán</>}.
              </p>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-bg3 text-xs text-muted text-left"><tr><th className="px-3 py-2">Fila</th><th className="px-3 py-2">Producto</th><th className="px-3 py-2">Qué pasa</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {vista.filas.map((f) => (
                      <tr key={f.numero}>
                        <td className="px-3 py-2 text-muted">{f.numero}</td>
                        <td className="px-3 py-2 text-text">{f.datos?.nombre || '—'}{f.datos?.stock !== undefined && <span className="text-muted"> · stock {f.datos.stock}</span>}</td>
                        <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${ACCION[f.accion].clase}`}>{ACCION[f.accion].texto}</span>{f.error && <span className="block text-xs text-danger-text mt-0.5">{f.error}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={onCerrar} className="h-11 px-4 text-muted text-sm rounded-xl border border-border bg-transparent cursor-pointer">Cancelar</button>
                <button type="button" onClick={aplicar} disabled={aplicando || nada} className="h-11 px-6 inline-flex items-center gap-2 bg-accent text-white text-sm font-semibold rounded-xl border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  {aplicando && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar importación
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
