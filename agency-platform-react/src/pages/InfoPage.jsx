import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Loader2, Wallet } from 'lucide-react';
import { interesadosService } from '../services/api';
import Logo from '../components/Logo';
import { Character } from '../components/Illustration';

const inputCls =
    'w-full min-h-11 bg-white border border-[#C9C9C9] rounded-xl px-4 py-2.5 text-base text-text placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors';
const labelCls = 'block text-sm font-semibold text-text mb-2';

const TIPOS = ['Restaurante', 'Tienda', 'Servicios', 'Salud', 'Belleza', 'Otro'];

// Cada personaje es una puerta de entrada: el visitante elige qué problema quiere resolver.
const ELENCO = [
    {
        id: 'nova', nombre: 'Nova', corto: 'Pedidos',
        titulo: 'Soy Nova, tu bot de ventas',
        texto: 'Atiendo tu WhatsApp 24/7: muestro tu catálogo, tomo el pedido y reviso el comprobante de pago mientras tú descansas.',
        alt: 'Nova, un robot redondo blanco y negro con acento rojo',
        demo: [['cliente', 'Hola, quiero 2 croissants'], ['bot', '¡Listo! 2 croissants: $9.000. Envíame el comprobante 🧾']],
    },
    {
        id: 'lucia', nombre: 'Lucía', corto: 'Clientes',
        titulo: 'Soy Lucía, tu atención al cliente',
        texto: 'Sigo cada conversación: quién escribió, qué pidió y en qué estado quedó. Nadie se queda sin respuesta.',
        alt: 'Lucía, de atención al cliente, con audífonos y un celular con burbuja de chat',
        demo: [['cliente', '¿Ya salió mi pedido?'], ['bot', 'Sí, va en camino. Llega en ~15 min 🛵']],
    },
    {
        id: 'mateo', nombre: 'Mateo', corto: 'Domicilios',
        titulo: 'Soy Mateo, tu domiciliario',
        texto: 'Recibo la entrega con su ruta y tarifa por km. Tú me sigues en el mapa y tu cliente ve por dónde va su pedido.',
        alt: 'Mateo, el domiciliario, con casco negro y mochila de reparto roja',
        demo: [['cliente', '¿Cuánto cuesta el domicilio?'], ['bot', 'A 3,2 km: $4.500. Lo sigues en vivo 📍']],
    },
    {
        id: 'sofia', nombre: 'Sofía', corto: 'Mi panel',
        titulo: 'Soy Sofía, la dueña… ¡como tú!',
        texto: 'Ventas del día, pedidos y estado de tu bot en un solo panel, sin perseguir chats.',
        alt: 'Sofía, la dueña del negocio, con chaqueta roja y una tableta en la mano',
        demo: [['bot', 'Hoy: 18 pedidos · $412.000 en ventas 📈'], ['cliente', '¡Y yo sin contestar nada!']],
    },
];

// Nova te va guiando según el campo del formulario donde estés.
const GUIA = {
    nombre: '¿Cómo te llamas? Así te escribo por tu nombre 😊',
    negocio: '¿Cómo se llama tu negocio? Lo uso para armar tu demo.',
    whatsapp: 'Por aquí te escribimos. Solo para contarte, nada de spam.',
    ciudad: 'Así adapto los domicilios y las tarifas a tu zona.',
    tipo_negocio: 'Con esto preparo un catálogo de ejemplo para ti.',
    mensaje: 'Cuéntame qué te quita más tiempo y empezamos por ahí.',
    _: '¡Hola! Soy Nova. Llena el formulario y te contamos cómo funciona 👇',
};

// Página pública (enlace de Instagram/TikTok): deja los datos de quien quiere saber más del proyecto.
const InfoPage = () => {
    const [params] = useSearchParams();
    const fuente = params.get('f') || 'instagram';
    const [form, setForm] = useState({ nombre: '', negocio: '', whatsapp: '', ciudad: '', tipo_negocio: '', mensaje: '', sitio_web: '' });
    const [acepta, setAcepta] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const [listo, setListo] = useState(false);
    const [activo, setActivo] = useState(ELENCO[0].id);
    const [interes, setInteres] = useState(null);
    const [campo, setCampo] = useState('_');
    const reducir = useReducedMotion();
    const p = ELENCO.find((x) => x.id === activo);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const foco = (k) => ({ onFocus: () => setCampo(k), onBlur: () => setCampo('_') });
    const elegirInteres = () => {
        setInteres(p);
        document.getElementById('formulario')?.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
    };

    const enviar = async (e) => {
        e.preventDefault();
        setError('');
        if (!acepta) {
            setError('Para continuar, autoriza el tratamiento de tus datos personales.');
            return;
        }
        setEnviando(true);
        try {
            const mensaje = [interes && `[Interés: ${interes.corto}]`, form.mensaje].filter(Boolean).join(' ').slice(0, 1000);
            await interesadosService.enviar({ ...form, mensaje, fuente, acepta_datos: true });
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
                <Link to="/" className="no-underline" aria-label="Antigravity"><Logo size={36} tone="dark" /></Link>
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
                        Conoce al equipo que trabaja por tu negocio. Elige qué te quita más tiempo.
                    </p>

                    <div role="tablist" aria-label="Personajes de Antigravity" className="grid grid-cols-4 gap-2 mb-4">
                        {ELENCO.map((c) => (
                            <button
                                key={c.id} role="tab" aria-selected={activo === c.id} aria-controls="personaje-panel"
                                onClick={() => setActivo(c.id)}
                                className={`min-h-11 flex flex-col items-center gap-1 rounded-xl border p-2 cursor-pointer transition-colors ${activo === c.id ? 'bg-accent/10 border-accent' : 'bg-white border-border hover:border-accent/50'}`}
                            >
                                <Character name={c.id} height={64} alt="" />
                                <span className="text-xs font-semibold">{c.corto}</span>
                            </button>
                        ))}
                    </div>

                    <div id="personaje-panel" role="tabpanel" className="bg-white border border-border rounded-2xl p-4 md:p-5">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={p.id}
                                initial={reducir ? false : { opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reducir ? {} : { opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                                className="flex gap-4 items-start"
                            >
                                <motion.div
                                    className="shrink-0"
                                    animate={reducir ? {} : { y: [0, -6, 0] }}
                                    transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                                    whileTap={reducir ? {} : { rotate: [0, -6, 6, 0], scale: 1.05 }}
                                >
                                    <Character name={p.id} height={150} alt={p.alt} />
                                </motion.div>
                                <div className="min-w-0">
                                    <h2 className="font-head text-lg font-bold">{p.titulo}</h2>
                                    <p className="text-muted text-sm mt-1 mb-3">{p.texto}</p>
                                    <div className="grid gap-1.5 mb-3" aria-label="Ejemplo de conversación">
                                        {p.demo.map(([quien, txt], i) => (
                                            <motion.div
                                                key={txt}
                                                initial={reducir ? false : { opacity: 0, x: quien === 'bot' ? 10 : -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: reducir ? 0 : 0.35 + i * 0.6 }}
                                                className={`text-[13px] px-3 py-2 rounded-2xl max-w-[90%] ${quien === 'bot' ? 'bg-accent/10 border border-border justify-self-end' : 'bg-bg2 border border-border'}`}
                                            >
                                                {txt}
                                            </motion.div>
                                        ))}
                                    </div>
                                    <button
                                        type="button" onClick={elegirInteres}
                                        className="min-h-11 px-4 rounded-xl bg-accent text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer border-none hover:opacity-90 transition"
                                    >
                                        Quiero esto <ArrowRight size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                        <Wallet size={18} className="text-accent shrink-0" /> Desde $25.000 al mes · Sin contratos largos · Pruébalo gratis
                    </p>
                </section>

                <section id="formulario" className="bg-white border border-border rounded-2xl shadow-lg p-6 scroll-mt-4" aria-live="polite">
                    {listo ? (
                        <div className="text-center py-6">
                            <motion.div
                                initial={reducir ? false : { scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                                className="mx-auto mb-2 w-fit"
                            >
                                <Character name={interes?.id || 'sofia'} height={180} alt="" />
                            </motion.div>
                            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-accent text-white flex items-center justify-center">
                                <Check size={22} />
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
                            <div className="flex items-start gap-3" role="status">
                                <Character name="nova" height={56} alt="" />
                                <AnimatePresence mode="wait">
                                    <motion.p
                                        key={campo}
                                        initial={reducir ? false : { opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-accent/10 border border-border rounded-2xl rounded-tl-sm px-3 py-2 text-[13px] flex-1"
                                    >
                                        {GUIA[campo]}
                                    </motion.p>
                                </AnimatePresence>
                            </div>
                            {interes && (
                                <div className="flex items-center justify-between gap-2 text-sm bg-bg2 border border-border rounded-xl px-3 py-2">
                                    <span>Te interesa: <strong>{interes.corto}</strong></span>
                                    <button type="button" onClick={() => setInteres(null)} className="text-muted underline bg-transparent border-none cursor-pointer min-h-11 px-2">Quitar</button>
                                </div>
                            )}
                            <div>
                                <label className={labelCls}>Tu nombre</label>
                                <input className={inputCls} value={form.nombre} onChange={set('nombre')} {...foco('nombre')} autoComplete="name" required maxLength={120} placeholder="Ej. María Gómez" />
                            </div>
                            <div>
                                <label className={labelCls}>Nombre de tu negocio</label>
                                <input className={inputCls} value={form.negocio} onChange={set('negocio')} {...foco('negocio')} required maxLength={150} placeholder="Ej. Sabores de Mocoa" />
                            </div>
                            <div>
                                <label className={labelCls}>Tu WhatsApp</label>
                                <input className={inputCls} value={form.whatsapp} onChange={set('whatsapp')} {...foco('whatsapp')} inputMode="tel" autoComplete="tel" required placeholder="300 123 4567" />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={labelCls}>Ciudad</label>
                                    <input className={inputCls} value={form.ciudad} onChange={set('ciudad')} {...foco('ciudad')} autoComplete="address-level2" maxLength={80} placeholder="Mocoa" />
                                </div>
                                <div>
                                    <label className={labelCls}>Tipo de negocio</label>
                                    <select className={inputCls} value={form.tipo_negocio} onChange={set('tipo_negocio')} {...foco('tipo_negocio')}>
                                        <option value="">Elige uno</option>
                                        {TIPOS.map((t) => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>¿Qué te gustaría resolver? <span className="text-muted font-normal">(opcional)</span></label>
                                <textarea className={inputCls} rows={3} value={form.mensaje} onChange={set('mensaje')} {...foco('mensaje')} maxLength={900} placeholder="Ej. Me escriben muchos clientes y no alcanzo a responder" />
                            </div>

                            {/* Campo trampa para bots: las personas no lo ven. */}
                            <input
                                tabIndex={-1} autoComplete="off" aria-hidden="true" name="sitio_web"
                                value={form.sitio_web} onChange={set('sitio_web')}
                                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
                            />

                            <label className="flex items-start gap-3 text-sm text-text cursor-pointer min-h-11">
                                <input
                                    type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)}
                                    className="mt-1 w-5 h-5 accent-[#C62828] shrink-0"
                                />
                                <span>
                                    Autorizo el tratamiento de mis datos personales para que me contacten sobre Antigravity, según la{' '}
                                    <Link to="/privacidad#datos" target="_blank" rel="noopener noreferrer" className="text-accent underline">política de tratamiento de datos</Link>{' '}
                                    (Ley 1581 de 2012).
                                </span>
                            </label>

                            {error && <div role="alert" className="p-3 rounded-xl border border-danger/50 bg-[#FDECEA] text-sm font-medium text-danger-text">{error}</div>}

                            <button
                                type="submit" disabled={enviando}
                                className="w-full min-h-12 bg-accent text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-60"
                            >
                                {enviando ? <Loader2 className="animate-spin" size={20} /> : <>Quiero que me contacten <ArrowRight size={20} /></>}
                            </button>
                            <p className="text-center text-xs text-muted">Puedes pedir que borremos tus datos cuando quieras.</p>
                        </form>
                    )}
                </section>
            </main>
        </div>
    );
};

export default InfoPage;
