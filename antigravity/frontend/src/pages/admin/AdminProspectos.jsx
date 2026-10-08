import { useCallback, useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import { ESTADOS, FUENTES, PLANTILLA_POR_DEFECTO, armarMensaje, enlaceWhatsapp, fechaCorta, hoyISO } from './prospectosUtils';
import './AdminProspectos.css';

const VACIO = { nombre_negocio: '', contacto: '', whatsapp: '', ciudad: '', fuente: 'instagram', video_url: '', notas: '' };

export default function AdminProspectos() {
  const [lista, setLista] = useState([]);
  const [stats, setStats] = useState({ por_estado: {}, seguimientos_pendientes: 0 });
  const [estado, setEstado] = useState('');
  const [q, setQ] = useState('');
  const [soloHoy, setSoloHoy] = useState(false);
  const [form, setForm] = useState(null);
  const [plantilla, setPlantilla] = useState(() => {
    try { return localStorage.getItem('ag_plantilla_prospectos') || PLANTILLA_POR_DEFECTO; } catch { return PLANTILLA_POR_DEFECTO; }
  });
  const [error, setError] = useState('');
  const enlaceForm = `${window.location.origin}/info?f=instagram`;
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    const p = new URLSearchParams();
    if (estado) p.set('estado', estado);
    if (q.trim()) p.set('q', q.trim());
    if (soloHoy) p.set('seguimiento', 'hoy');
    try {
      const r = await apiService.get(`/api/admin/prospectos?${p}`);
      setLista(r.prospectos);
      setStats(r.stats);
      setError('');
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo cargar');
    }
  }, [estado, q, soloHoy]);

  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [cargar]);

  const guardarPlantilla = (v) => {
    setPlantilla(v);
    try { localStorage.setItem('ag_plantilla_prospectos', v); } catch { /* sin almacenamiento: se usa solo en esta sesión */ }
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(enlaceForm); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { window.prompt('Copia el enlace:', enlaceForm); }
  };

  const guardar = async (e) => {
    e.preventDefault();
    try {
      if (form.id) await apiService.put(`/api/admin/prospectos/${form.id}`, form);
      else await apiService.post('/api/admin/prospectos', form);
      setForm(null);
      cargar();
    } catch (err) { setError(err.response?.data?.error || 'No se pudo guardar'); }
  };

  const cambiarEstado = async (p, nuevo) => {
    try { await apiService.put(`/api/admin/prospectos/${p.id}`, { estado: nuevo }); cargar(); } catch (err) { setError(err.response?.data?.error || 'Error'); }
  };

  const enviar = async (p) => {
    const url = enlaceWhatsapp(p.whatsapp, armarMensaje(plantilla, p));
    if (!url) return;
    window.open(url, '_blank', 'noopener');
    try { await apiService.post(`/api/admin/prospectos/${p.id}/marcar-enviado`, {}); cargar(); } catch { /* el WhatsApp ya se abrió; el registro se puede marcar luego */ }
  };

  const eliminar = async (p) => {
    if (!window.confirm(`¿Eliminar a ${p.nombre_negocio}?`)) return;
    try { await apiService.delete(`/api/admin/prospectos/${p.id}`); cargar(); } catch (err) { setError(err.response?.data?.error || 'Error'); }
  };

  const hoy = hoyISO();

  return (
    <div className="prosp">
      <div className="prosp-head">
        <div>
          <h1>Prospectos</h1>
          <p>Personas interesadas: las que llenan el formulario y las que agregas tú.</p>
        </div>
        <button className="prosp-btn" onClick={() => setForm({ ...VACIO })}>+ Nuevo prospecto</button>
      </div>

      <div className="prosp-link">
        <div>
          <strong>Enlace para Instagram</strong>
          <code>{enlaceForm}</code>
        </div>
        <button className="prosp-btn prosp-btn-ghost" onClick={copiar}>{copiado ? '¡Copiado!' : 'Copiar enlace'}</button>
      </div>

      <div className="prosp-chips">
        <button className={!estado ? 'on' : ''} onClick={() => setEstado('')}>Todos</button>
        {ESTADOS.map((s) => (
          <button key={s.id} className={estado === s.id ? 'on' : ''} onClick={() => setEstado(s.id)}>
            {s.label} <b>{stats.por_estado[s.id] ?? 0}</b>
          </button>
        ))}
      </div>

      <div className="prosp-tools">
        <input placeholder="Buscar por negocio, contacto, ciudad…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label><input type="checkbox" checked={soloHoy} onChange={(e) => setSoloHoy(e.target.checked)} /> Seguimientos pendientes ({stats.seguimientos_pendientes})</label>
      </div>

      <details className="prosp-tpl">
        <summary>Mensaje de WhatsApp</summary>
        <textarea rows={4} value={plantilla} onChange={(e) => guardarPlantilla(e.target.value)} />
        <small>Variables: {'{nombre}'} {'{negocio}'} {'{video}'}</small>
      </details>

      {error && <div className="prosp-error">{error}</div>}

      <div className="prosp-list">
        {lista.length === 0 && <div className="prosp-empty">Aún no hay prospectos con este filtro.</div>}
        {lista.map((p) => {
          const vencido = p.proximo_seguimiento && p.proximo_seguimiento <= hoy && !['cliente', 'descartado'].includes(p.estado);
          return (
            <article key={p.id} className="prosp-card">
              <div className="prosp-main">
                <h3>{p.nombre_negocio}</h3>
                <p>{[p.contacto, p.ciudad, p.fuente].filter(Boolean).join(' · ')}</p>
                {p.notas && <p className="prosp-notas">{p.notas.slice(-220)}</p>}
                {p.proximo_seguimiento && <span className={`prosp-seg ${vencido ? 'late' : ''}`}>Seguimiento: {fechaCorta(p.proximo_seguimiento)}</span>}
              </div>
              <div className="prosp-actions">
                <select value={p.estado} onChange={(e) => cambiarEstado(p, e.target.value)}>
                  {ESTADOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                {p.whatsapp && <button className="prosp-btn" onClick={() => enviar(p)}>WhatsApp</button>}
                <button className="prosp-btn prosp-btn-ghost" onClick={() => setForm({ ...VACIO, ...p, proximo_seguimiento: p.proximo_seguimiento || '' })}>Editar</button>
                <button className="prosp-btn prosp-btn-ghost" onClick={() => eliminar(p)} aria-label="Eliminar">🗑</button>
              </div>
            </article>
          );
        })}
      </div>

      {form && (
        <div className="prosp-modal" onClick={() => setForm(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
            <h2>{form.id ? 'Editar prospecto' : 'Nuevo prospecto'}</h2>
            {[['nombre_negocio', 'Negocio *'], ['contacto', 'Contacto'], ['whatsapp', 'WhatsApp'], ['ciudad', 'Ciudad'], ['video_url', 'Enlace del video']].map(([k, l]) => (
              <label key={k}>{l}<input value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>
            ))}
            <label>Fuente
              <select value={form.fuente || 'otro'} onChange={(e) => setForm({ ...form, fuente: e.target.value })}>
                {FUENTES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </label>
            <label>Próximo seguimiento<input type="date" value={form.proximo_seguimiento || ''} onChange={(e) => setForm({ ...form, proximo_seguimiento: e.target.value })} /></label>
            <label>Notas<textarea rows={3} value={form.notas || ''} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></label>
            <div className="prosp-modal-actions">
              <button type="button" className="prosp-btn prosp-btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit" className="prosp-btn">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
