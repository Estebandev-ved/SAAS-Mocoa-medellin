import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Loader2, MessageCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ESTADOS, FUENTES, PLANTILLA_POR_DEFECTO, armarMensaje, enlaceWhatsapp, fechaCorta, hoyISO } from '../utils/prospectosUtils';

const VACIO = { nombre_negocio: '', contacto: '', whatsapp: '', ciudad: '', fuente: 'instagram', video_url: '', proximo_seguimiento: '', notas: '' };
const inputCls = 'w-full min-h-11 bg-white border border-[#C9C9C9] rounded-xl px-3 py-2 text-sm text-text focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent';

// Registro de personas interesadas (formulario /info + las que agrega el admin). Solo rol admin.
const ProspectosPage = () => {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const esAdmin = user?.rol === 'admin' || user?.rol === 'superadmin';

    const [lista, setLista] = useState([]);
    const [stats, setStats] = useState({ por_estado: {}, seguimientos_pendientes: 0 });
    const [cargando, setCargando] = useState(true);
    const [estado, setEstado] = useState('');
    const [q, setQ] = useState('');
    const [soloHoy, setSoloHoy] = useState(false);
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [copiado, setCopiado] = useState(false);
    const [plantilla, setPlantilla] = useState(() => {
        try { return localStorage.getItem('ag_plantilla_prospectos') || PLANTILLA_POR_DEFECTO; } catch { return PLANTILLA_POR_DEFECTO; }
    });
    const enlaceForm = `${window.location.origin}/info?f=instagram`;
    const hoy = hoyISO();

    useEffect(() => {
        if (!authLoading && !esAdmin) navigate('/dashboard', { replace: true });
    }, [authLoading, esAdmin, navigate]);

    const cargar = useCallback(async () => {
        const p = new URLSearchParams();
        if (estado) p.set('estado', estado);
        if (q.trim()) p.set('q', q.trim());
        if (soloHoy) p.set('seguimiento', 'hoy');
        try {
            const { data } = await api.get(`/admin/prospectos?${p}`);
            setLista(data.prospectos);
            setStats(data.stats);
            setError('');
        } catch (e) {
            setError(e.response?.data?.error || 'No se pudo cargar');
        } finally {
            setCargando(false);
        }
    }, [estado, q, soloHoy]);

    useEffect(() => {
        if (!esAdmin) return undefined;
        const t = setTimeout(cargar, 250);
        return () => clearTimeout(t);
    }, [cargar, esAdmin]);

    const guardarPlantilla = (v) => {
        setPlantilla(v);
        try { localStorage.setItem('ag_plantilla_prospectos', v); } catch { /* sin almacenamiento: vale solo esta sesión */ }
    };

    const copiar = async () => {
        try { await navigator.clipboard.writeText(enlaceForm); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { window.prompt('Copia el enlace:', enlaceForm); }
    };

    const guardar = async (e) => {
        e.preventDefault();
        try {
            if (form.id) await api.put(`/admin/prospectos/${form.id}`, form);
            else await api.post('/admin/prospectos', form);
            setForm(null);
            cargar();
        } catch (err) { setError(err.response?.data?.error || 'No se pudo guardar'); }
    };

    const cambiarEstado = async (p, nuevo) => {
        try { await api.put(`/admin/prospectos/${p.id}`, { estado: nuevo }); cargar(); } catch (err) { setError(err.response?.data?.error || 'Error'); }
    };

    const enviar = async (p) => {
        const url = enlaceWhatsapp(p.whatsapp, armarMensaje(plantilla, p));
        if (!url) return;
        window.open(url, '_blank', 'noopener');
        try { await api.post(`/admin/prospectos/${p.id}/marcar-enviado`, {}); cargar(); } catch { /* WhatsApp ya se abrió; se puede marcar luego */ }
    };

    const eliminar = async (p) => {
        if (!window.confirm(`¿Eliminar a ${p.nombre_negocio}?`)) return;
        try { await api.delete(`/admin/prospectos/${p.id}`); cargar(); } catch (err) { setError(err.response?.data?.error || 'Error'); }
    };

    if (authLoading || !esAdmin) {
        return <div className="min-h-screen bg-bg flex items-center justify-center"><Loader2 size={40} className="text-accent animate-spin" /></div>;
    }

    return (
        <div className="min-h-screen bg-bg p-4 lg:p-10">
            <div className="max-w-5xl mx-auto grid gap-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-xl bg-bg2 border border-border hover:border-accent/30 hover:bg-accent/10 transition-all" aria-label="Volver">
                            <ArrowLeft className="w-5 h-5 text-muted" />
                        </button>
                        <div>
                            <h1 className="font-head text-3xl font-bold">Prospectos</h1>
                            <p className="text-muted text-sm">Los que llenan el formulario y los que agregas tú.</p>
                        </div>
                    </div>
                    <button onClick={() => setForm({ ...VACIO })} className="flex items-center gap-2 bg-accent text-white px-5 min-h-11 rounded-xl font-bold">
                        <Plus size={18} /> Nuevo prospecto
                    </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-border border-l-4 border-l-accent rounded-xl">
                    <div className="min-w-0">
                        <strong className="font-head block">Enlace para Instagram</strong>
                        <code className="text-xs text-muted break-all">{enlaceForm}</code>
                    </div>
                    <button onClick={copiar} className="flex items-center gap-2 px-4 min-h-10 rounded-xl border border-border font-semibold text-sm">
                        <Copy size={16} /> {copiado ? '¡Copiado!' : 'Copiar enlace'}
                    </button>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setEstado('')} className={`px-4 min-h-9 rounded-full border text-sm ${!estado ? 'bg-accent/10 border-accent text-accent font-semibold' : 'border-border text-muted'}`}>Todos</button>
                    {ESTADOS.map((s) => (
                        <button key={s.id} onClick={() => setEstado(s.id)} className={`px-4 min-h-9 rounded-full border text-sm ${estado === s.id ? 'bg-accent/10 border-accent text-accent font-semibold' : 'border-border text-muted'}`}>
                            {s.label} <b>{stats.por_estado[s.id] ?? 0}</b>
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                        <input className={`${inputCls} pl-9`} placeholder="Buscar por negocio, contacto, ciudad…" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={soloHoy} onChange={(e) => setSoloHoy(e.target.checked)} />
                        Seguimientos pendientes ({stats.seguimientos_pendientes})
                    </label>
                </div>

                <details className="p-4 bg-white border border-border rounded-xl">
                    <summary className="cursor-pointer font-semibold">Mensaje de WhatsApp</summary>
                    <textarea className={`${inputCls} mt-3`} rows={4} value={plantilla} onChange={(e) => guardarPlantilla(e.target.value)} />
                    <small className="text-muted">Variables: {'{nombre}'} {'{negocio}'} {'{video}'}</small>
                </details>

                {error && <div role="alert" className="p-3 rounded-xl bg-[#FDECEA] text-danger-text text-sm">{error}</div>}

                <div className="grid gap-3">
                    {cargando && <div className="flex justify-center p-8"><Loader2 className="text-accent animate-spin" /></div>}
                    {!cargando && lista.length === 0 && <div className="p-8 text-center text-muted border border-dashed border-border rounded-xl">Aún no hay prospectos con este filtro.</div>}
                    {lista.map((p) => {
                        const vencido = p.proximo_seguimiento && p.proximo_seguimiento <= hoy && !['cliente', 'descartado'].includes(p.estado);
                        return (
                            <article key={p.id} className="flex flex-wrap justify-between gap-4 p-4 bg-white border border-border rounded-xl">
                                <div className="min-w-0 flex-1 basis-64">
                                    <h3 className="font-head font-bold">{p.nombre_negocio}</h3>
                                    <p className="text-sm text-muted">{[p.contacto, p.ciudad, p.fuente].filter(Boolean).join(' · ')}</p>
                                    {p.notas && <p className="text-xs text-muted whitespace-pre-line mt-1">{p.notas.slice(-220)}</p>}
                                    {p.proximo_seguimiento && <span className={`text-xs font-semibold ${vencido ? 'text-accent' : 'text-muted'}`}>Seguimiento: {fechaCorta(p.proximo_seguimiento)}</span>}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <select className="min-h-10 border border-border rounded-xl px-2 bg-white text-sm" value={p.estado} onChange={(e) => cambiarEstado(p, e.target.value)}>
                                        {ESTADOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </select>
                                    {p.whatsapp && (
                                        <button onClick={() => enviar(p)} className="flex items-center gap-1 px-4 min-h-10 rounded-xl bg-accent text-white font-semibold text-sm">
                                            <MessageCircle size={16} /> WhatsApp
                                        </button>
                                    )}
                                    <button onClick={() => setForm({ ...VACIO, ...p, proximo_seguimiento: p.proximo_seguimiento || '' })} className="p-2.5 rounded-xl border border-border" aria-label="Editar"><Pencil size={16} /></button>
                                    <button onClick={() => eliminar(p)} className="p-2.5 rounded-xl border border-border" aria-label="Eliminar"><Trash2 size={16} /></button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>

            {form && (
                <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setForm(null)}>
                    <form onClick={(e) => e.stopPropagation()} onSubmit={guardar} className="w-full max-w-md max-h-[90vh] overflow-auto grid gap-3 p-6 rounded-2xl bg-white">
                        <h2 className="font-head text-xl font-bold">{form.id ? 'Editar prospecto' : 'Nuevo prospecto'}</h2>
                        {[['nombre_negocio', 'Negocio *'], ['contacto', 'Contacto'], ['whatsapp', 'WhatsApp'], ['ciudad', 'Ciudad'], ['video_url', 'Enlace del video']].map(([k, l]) => (
                            <label key={k} className="grid gap-1 text-sm font-semibold">{l}
                                <input className={inputCls} value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                            </label>
                        ))}
                        <label className="grid gap-1 text-sm font-semibold">Fuente
                            <select className={inputCls} value={form.fuente || 'otro'} onChange={(e) => setForm({ ...form, fuente: e.target.value })}>
                                {FUENTES.map((f) => <option key={f}>{f}</option>)}
                            </select>
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">Próximo seguimiento
                            <input type="date" className={inputCls} value={form.proximo_seguimiento || ''} onChange={(e) => setForm({ ...form, proximo_seguimiento: e.target.value })} />
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">Notas
                            <textarea className={inputCls} rows={3} value={form.notas || ''} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
                        </label>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setForm(null)} className="px-4 min-h-10 rounded-xl border border-border">Cancelar</button>
                            <button type="submit" className="px-5 min-h-10 rounded-xl bg-accent text-white font-bold">Guardar</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ProspectosPage;
