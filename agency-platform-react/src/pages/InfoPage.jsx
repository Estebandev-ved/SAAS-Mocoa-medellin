import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Loader2, MessageCircle, MapPin, Wallet } from 'lucide-react';
import { interesadosService } from '../services/api';
import FeedbackMessage from '../components/FeedbackMessage';

const inputCls =
    'w-full min-h-11 bg-white border border-[#C9C9C9] rounded-xl px-4 py-2.5 text-base text-text placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors';
const labelCls = 'block text-sm font-semibold text-text mb-2';

const TIPOS = ['Restaurante', 'Tienda', 'Servicios', 'Salud', 'Belleza', 'Otro'];

const BENEFICIOS = [
    { icon: MessageCircle, t: 'Toma pedidos solo', d: 'Tu asistente atiende en WhatsApp 24/7, confirma pagos y arma el pedido.' },
    { icon: MapPin, t: 'Domicilios con mapa', d: 'Ruta, tarifa por km y seguimiento en vivo para tu cliente.' },
    { icon: Wallet, t: 'Desde $25.000 al mes', d: 'Planes para negocios pequeños. Sin contratos largos.' },
];

// Página pública (enlace de Instagram/TikTok): deja los datos de quien quiere saber más del proyecto.
const InfoPage = () => {
    const [params] = useSearchParams();
    const fuente = params.get('f') || 'instagram';
    const [form, setForm] = useState({ nombre: '', negocio: '', whatsapp: '', ciudad: '', tipo_negocio: '', mensaje: '', sitio_web: '' });
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const [listo, setListo] = useState(false);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const enviar = async (e) => {
        e.preventDefault();
        setError('');
        setEnviando(true);
        try {
            await interesadosService.enviar({ ...form, fuente });
            setListo(true);
        } catch (err) {
            setError(err.response?.data?.error || 'No pudimos enviar tus datos. Intenta de nuevo.');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg text-text">
            <header className="max-w-5xl mx-auto px-4 py-5">
                <Link to="/" className="font-head font-extrabold tracking-[0.15em] text-lg">ANTIGRAVITY</Link>
            </header>

            <main className="max-w-5xl mx-auto px-4 pb-16 grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-start md:pt-6">
                <section>
                    <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
                        Asistente de WhatsApp con IA
                    </span>
                    <h1 className="font-head text-3xl md:text-5xl font-extrabold tracking-tight mb-3">
                        Que tu WhatsApp venda mientras tú descansas
                    </h1>
                    <p className="text-muted text-lg mb-6">
                        Déjanos tus datos y te contamos cómo funciona para tu negocio. Sin compromiso.
                    </p>
                    <ul className="grid gap-3">
                        {BENEFICIOS.map(({ icon: Icon, t, d }) => (
                            <li key={t} className="flex gap-3 p-4 bg-white border border-border border-l-4 border-l-accent rounded-xl">
                                <Icon className="text-accent shrink-0 mt-0.5" size={20} />
                                <div>
                                    <strong className="font-head block">{t}</strong>
                                    <span className="text-muted text-sm">{d}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="bg-white border border-border rounded-2xl shadow-lg p-6" aria-live="polite">
                    {listo ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent text-white flex items-center justify-center">
                                <Check size={32} />
                            </div>
                            <h2 className="font-head text-2xl font-bold mb-2">¡Listo, {form.nombre.trim().split(/\s+/)[0]}!</h2>
                            <p className="text-muted">Recibimos tus datos. Te escribimos por WhatsApp muy pronto para contarte todo.</p>
                        </div>
                    ) : (
                        <form onSubmit={enviar} className="grid gap-4" noValidate>
                            <div>
                                <h2 className="font-head text-2xl font-bold">Quiero saber más</h2>
                                <p className="text-muted text-sm">Te respondemos por WhatsApp.</p>
                            </div>
                            <div>
                                <label className={labelCls}>Tu nombre</label>
                                <input className={inputCls} value={form.nombre} onChange={set('nombre')} autoComplete="name" required maxLength={120} placeholder="Ej. María Gómez" />
                            </div>
                            <div>
                                <label className={labelCls}>Nombre de tu negocio</label>
                                <input className={inputCls} value={form.negocio} onChange={set('negocio')} required maxLength={150} placeholder="Ej. Sabores de Mocoa" />
                            </div>
                            <div>
                                <label className={labelCls}>Tu WhatsApp</label>
                                <input className={inputCls} value={form.whatsapp} onChange={set('whatsapp')} inputMode="tel" autoComplete="tel" required placeholder="300 123 4567" />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={labelCls}>Ciudad</label>
                                    <input className={inputCls} value={form.ciudad} onChange={set('ciudad')} autoComplete="address-level2" maxLength={80} placeholder="Mocoa" />
                                </div>
                                <div>
                                    <label className={labelCls}>Tipo de negocio</label>
                                    <select className={inputCls} value={form.tipo_negocio} onChange={set('tipo_negocio')}>
                                        <option value="">Elige uno</option>
                                        {TIPOS.map((t) => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>¿Qué te gustaría resolver? <span className="text-muted font-normal">(opcional)</span></label>
                                <textarea className={inputCls} rows={3} value={form.mensaje} onChange={set('mensaje')} maxLength={1000} placeholder="Ej. Me escriben muchos clientes y no alcanzo a responder" />
                            </div>

                            {/* Campo trampa para bots: las personas no lo ven. */}
                            <input
                                tabIndex={-1} autoComplete="off" aria-hidden="true" name="sitio_web"
                                value={form.sitio_web} onChange={set('sitio_web')}
                                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
                            />

                            {error && <FeedbackMessage type="error">{error}</FeedbackMessage>}

                            <button
                                type="submit" disabled={enviando}
                                className="w-full min-h-12 bg-accent text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-60"
                            >
                                {enviando ? <Loader2 className="animate-spin" size={20} /> : <>Quiero que me contacten <ArrowRight size={20} /></>}
                            </button>
                            <p className="text-center text-xs text-muted">Usamos tus datos solo para contactarte sobre Antigravity.</p>
                        </form>
                    )}
                </section>
            </main>
        </div>
    );
};

export default InfoPage;
