import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
    ArrowRight, BookOpen, Check, GraduationCap, HandCoins, Loader2, MessageCircle, Package, PiggyBank, Wallet, WifiOff,
} from 'lucide-react';
import { interesadosService } from '../services/api';
import Logo from '../components/Logo';
import { Character } from '../components/Illustration';

const inputCls =
    'w-full min-h-11 bg-white border border-[#C9C9C9] rounded-xl px-4 py-2.5 text-base text-text placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors';
const labelCls = 'block text-sm font-semibold text-text mb-2';

// Dos caminos según lo que la persona vive hoy (ver docs/estrategia-y-metas.md): quien lleva las cuentas en
// cuaderno necesita la Caja; quien vende por WhatsApp, el bot. La Caja es la etapa actual, por eso va primero.
// El enlace puede fijar el camino: /info?p=caja o /info?p=bot (además de ?f=instagram para la fuente).
const CAMINOS = [
    { id: 'caja', icono: BookOpen, texto: 'Anoto en cuaderno' },
    { id: 'bot', icono: MessageCircle, texto: 'Vendo por WhatsApp' },
];

const TIPOS = {
    caja: ['Comida o postres', 'Bebidas', 'Ropa y accesorios', 'Papelería o útiles', 'Tienda', 'Belleza', 'Otro'],
    bot: ['Restaurante', 'Tienda', 'Servicios', 'Salud', 'Belleza', 'Otro'],
};

// Lo que la Caja ya hace hoy (repo granizados-caja). Sin cifras inventadas: la tarjeta de ganancia dice "Ejemplo".
const BENEFICIOS_CAJA = [
    { icono: PiggyBank, titulo: 'Cuánto ganaste de verdad', texto: 'Lo vendido menos lo que te costó y tus gastos. Sin sumar a mano.' },
    { icono: Wallet, titulo: 'Vendes en 2 toques', texto: 'Tocas el producto, cobras y listo. Efectivo o Nequi.' },
    { icono: Package, titulo: 'Sabes cuánto te queda', texto: 'El inventario baja solo con cada venta y te avisa antes de que se acabe.' },
    { icono: HandCoins, titulo: 'Quién te debe', texto: 'Anota el fiado y manda el recordatorio por WhatsApp con un toque.' },
    { icono: WifiOff, titulo: 'Funciona sin señal', texto: 'En la U o en la calle: vende sin internet y se guarda cuando vuelve la señal.' },
];

const PREGUNTAS_CAJA = [
    ['¿Necesito computador?', 'No. Se instala en tu celular como una app, desde el navegador.'],
    ['¿Tengo que firmar algo o pagar un año?', 'No. Pagas mes a mes y la dejas cuando quieras.'],
    ['¿Cómo funciona el plan Universitario?', 'Es la misma Caja por $15.000 al mes. Solo verificas que eres estudiante con el correo de tu universidad.'],
];

// Un día de ejemplo para la tarjeta "¿Cuánto gané hoy?".
const EJEMPLO_DIA = { vendiste: 186000, costo: 92000, gastos: 14000 };
const pesos = (n) => `$${n.toLocaleString('es-CO')}`;

// Cada personaje es una puerta de entrada al bot: el visitante elige qué problema quiere resolver.
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
    caja: {
        nombre: '¿Cómo te llamas? Así te escribo por tu nombre 😊',
        negocio: '¿Cómo se llama tu emprendimiento? Aunque sea pequeño, cuenta.',
        whatsapp: 'Por aquí te escribimos para mostrarte la Caja. Nada de spam.',
        ciudad: '¿En qué ciudad vendes?',
        tipo_negocio: 'Con esto te muestro un ejemplo con productos como los tuyos.',
        universidad: 'Si eres estudiante, te cuento cómo pagar $15.000 en vez de $25.000.',
        mensaje: '¿Qué te enreda más hoy: las cuentas, el inventario o el fiado?',
        _: '¡Hola! Soy Nova. Déjame tus datos y te muestro la Caja por WhatsApp 👇',
    },
    bot: {
        nombre: '¿Cómo te llamas? Así te escribo por tu nombre 😊',
        negocio: '¿Cómo se llama tu negocio? Lo uso para armar tu demo.',
        whatsapp: 'Por aquí te escribimos. Solo para contarte, nada de spam.',
        ciudad: 'Así adapto los domicilios y las tarifas a tu zona.',
        tipo_negocio: 'Con esto preparo un catálogo de ejemplo para ti.',
        mensaje: 'Cuéntame qué te quita más tiempo y empezamos por ahí.',
        _: '¡Hola! Soy Nova. Llena el formulario y te contamos cómo funciona 👇',
    },
};

// "¿Cuánto gané hoy?" como lo muestra la Caja, con números de ejemplo (lo dice en pantalla).
function TarjetaGanancia({ reducir }) {
    const { vendiste, costo, gastos } = EJEMPLO_DIA;
    const filas = [['Vendiste', vendiste, ''], ['Te costó lo vendido', costo, '−'], ['Gastos del día', gastos, '−']];
    return (
        <div className="bg-white border border-border rounded-2xl p-4 md:p-5 shadow-sm" aria-label="Ejemplo de un día en la Caja">
            <div className="flex items-center justify-between mb-3">
                <p className="font-head font-bold">¿Cuánto gané hoy?</p>
                <span className="text-[11px] font-semibold text-muted bg-bg2 border border-border rounded-full px-2 py-0.5">Ejemplo</span>
            </div>
            <dl className="grid gap-1.5 text-sm">
                {filas.map(([etiqueta, valor, signo], i) => (
                    <motion.div
                        key={etiqueta} className="flex justify-between"
                        initial={reducir ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: reducir ? 0 : 0.2 + i * 0.25 }}
                    >
                        <dt className="text-muted">{etiqueta}</dt>
                        <dd className="font-mono">{signo}{pesos(valor)}</dd>
                    </motion.div>
                ))}
            </dl>
            <motion.div
                className="mt-3 pt-3 border-t border-border flex justify-between items-baseline"
                initial={reducir ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: reducir ? 0 : 1, type: 'spring', stiffness: 220, damping: 16 }}
            >
                <span className="font-semibold">Ganaste</span>
                <span className="font-head text-2xl font-extrabold text-success">{pesos(vendiste - costo - gastos)}</span>
            </motion.div>
        </div>
    );
}

function VistaCaja({ reducir, onQuiero }) {
    return (
        <>
            <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
                Caja para emprendedores
            </span>
            <h1 className="font-head text-3xl md:text-5xl font-extrabold tracking-tight mb-3">
                Sabe cuánto vendiste y cuánto ganaste, sin cuaderno
            </h1>
            <p className="text-muted text-lg mb-6">
                Tus ventas, tu inventario y tu plata en el celular. Hecha para quien vende en la U, en la calle o por encargo.
            </p>

            <TarjetaGanancia reducir={reducir} />

            {/* En el celular el formulario queda muy abajo: atajo directo. */}
            <button
                type="button" onClick={onQuiero}
                className="md:hidden mt-4 w-full min-h-12 rounded-xl bg-accent text-white font-bold inline-flex items-center justify-center gap-2 border-none cursor-pointer"
            >
                Quiero verla <ArrowRight size={18} />
            </button>

            <ul className="grid gap-3 sm:grid-cols-2 mt-5">
                {BENEFICIOS_CAJA.map(({ icono: Icono, titulo, texto }) => (
                    <li key={titulo} className="flex gap-3 bg-white border border-border rounded-2xl p-3 sm:last:odd:col-span-2">
                        <span className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                            <Icono size={18} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                            <strong className="block text-sm">{titulo}</strong>
                            <span className="text-[13px] text-muted">{texto}</span>
                        </span>
                    </li>
                ))}
            </ul>

            <div className="grid grid-cols-2 gap-3 mt-5" aria-label="Precios de la Caja">
                <div className="bg-white border-2 border-accent rounded-2xl p-4">
                    <p className="text-xs font-semibold text-accent inline-flex items-center gap-1">
                        <GraduationCap size={14} aria-hidden="true" /> Universitario
                    </p>
                    <p className="font-head text-2xl font-extrabold mt-1 whitespace-nowrap">$15.000<span className="text-sm font-normal text-muted"> /mes</span></p>
                    <p className="text-xs text-muted mt-1">Con el correo de tu universidad</p>
                </div>
                <div className="bg-white border border-border rounded-2xl p-4">
                    <p className="text-xs font-semibold text-muted">Emprendedor</p>
                    <p className="font-head text-2xl font-extrabold mt-1 whitespace-nowrap">$25.000<span className="text-sm font-normal text-muted"> /mes</span></p>
                    <p className="text-xs text-muted mt-1">Para cualquier negocio</p>
                </div>
            </div>
            <p className="mt-3 text-sm text-muted">Sin contratos: pagas mes a mes · Pruébala gratis</p>

            <div className="mt-6 grid gap-2">
                {PREGUNTAS_CAJA.map(([pregunta, respuesta]) => (
                    <details key={pregunta} className="bg-white border border-border rounded-xl px-4 py-3 group">
                        <summary className="font-semibold text-sm cursor-pointer min-h-6 list-none flex justify-between gap-2">
                            {pregunta} <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-45">+</span>
                        </summary>
                        <p className="text-sm text-muted mt-2">{respuesta}</p>
                    </details>
                ))}
            </div>
        </>
    );
}

function VistaBot({ reducir, activo, setActivo, onQuiero }) {
    const p = ELENCO.find((x) => x.id === activo);
    return (
        <>
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
                                type="button" onClick={() => onQuiero(p)}
                                className="min-h-11 px-4 rounded-xl bg-accent text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer border-none hover:opacity-90 transition"
                            >
                                Quiero esto <ArrowRight size={16} />
                            </button>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* $25.000 es la Caja; el bot arranca en el plan Inicial. */}
            <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <Wallet size={18} className="text-accent shrink-0" /> Bot desde $89.000 al mes · Sin contratos largos · Pruébalo gratis
            </p>
        </>
    );
}

// Página pública (enlace de Instagram/TikTok): deja los datos de quien quiere saber más del proyecto.
const InfoPage = () => {
    const [params] = useSearchParams();
    const fuente = params.get('f') || 'instagram';
    const [camino, setCamino] = useState(params.get('p') === 'bot' ? 'bot' : 'caja');
    const esCaja = camino === 'caja';
    const [form, setForm] = useState({ nombre: '', negocio: '', whatsapp: '', ciudad: '', tipo_negocio: '', universidad: '', mensaje: '', sitio_web: '' });
    const [estudiante, setEstudiante] = useState(false);
    const [acepta, setAcepta] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const [listo, setListo] = useState(false);
    const [activo, setActivo] = useState(ELENCO[0].id);
    const [interes, setInteres] = useState(null);
    const [campo, setCampo] = useState('_');
    const reducir = useReducedMotion();
    const guia = GUIA[camino];

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const foco = (k) => ({ onFocus: () => setCampo(k), onBlur: () => setCampo('_') });
    const cambiarCamino = (id) => {
        setCamino(id);
        setInteres(null);
        setForm((f) => ({ ...f, tipo_negocio: '' }));
    };
    const irAlFormulario = () =>
        document.getElementById('formulario')?.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
    const elegirInteres = (personaje) => {
        setInteres(personaje);
        irAlFormulario();
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
            // Las etiquetas entre corchetes llegan a las notas del prospecto (Admin → Prospectos) para saber qué ofrecerle.
            const universidad = form.universidad.trim();
            const etiquetas = esCaja
                ? ['[Interés: Caja]', estudiante && `[Universitario${universidad ? `: ${universidad}` : ''}]`]
                : [interes && `[Interés: ${interes.corto}]`];
            const mensaje = [...etiquetas, form.mensaje].filter(Boolean).join(' ').slice(0, 1000);
            const { universidad: _sinUso, ...datos } = form;
            await interesadosService.enviar({ ...datos, mensaje, fuente, acepta_datos: true });
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
                    <div role="radiogroup" aria-label="¿Qué te pasa hoy?" className="grid grid-cols-2 gap-1 mb-5 p-1 bg-white border border-border rounded-2xl">
                        {CAMINOS.map(({ id, icono: Icono, texto }) => (
                            <button
                                key={id} type="button" role="radio" aria-checked={camino === id}
                                onClick={() => cambiarCamino(id)}
                                className={`min-h-11 px-3 py-2 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 border-none cursor-pointer transition-colors ${camino === id ? 'bg-accent text-white' : 'bg-transparent text-text hover:bg-bg2'}`}
                            >
                                <Icono size={16} aria-hidden="true" className="shrink-0" /> {texto}
                            </button>
                        ))}
                    </div>

                    {esCaja
                        ? <VistaCaja reducir={reducir} onQuiero={irAlFormulario} />
                        : <VistaBot reducir={reducir} activo={activo} setActivo={setActivo} onQuiero={elegirInteres} />}
                </section>

                <section id="formulario" className="bg-white border border-border rounded-2xl shadow-lg p-6 scroll-mt-4 md:sticky md:top-4" aria-live="polite">
                    {listo ? (
                        <div className="text-center py-6">
                            <motion.div
                                initial={reducir ? false : { scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                                className="mx-auto mb-2 w-fit"
                            >
                                <Character name={!esCaja && interes ? interes.id : 'sofia'} height={180} alt="" />
                            </motion.div>
                            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-accent text-white flex items-center justify-center">
                                <Check size={22} />
                            </div>
                            <h2 className="font-head text-2xl font-bold mb-2">¡Listo, {form.nombre.trim().split(/\s+/)[0]}!</h2>
                            <p className="text-muted">
                                {esCaja
                                    ? 'Recibimos tus datos. Te escribimos por WhatsApp muy pronto para mostrarte la Caja.'
                                    : 'Recibimos tus datos. Te escribimos por WhatsApp muy pronto para contarte todo.'}
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={enviar} className="grid gap-4" noValidate>
                            <div>
                                <h2 className="font-head text-2xl font-bold">{esCaja ? 'Quiero ver la Caja' : 'Quiero saber más'}</h2>
                                <p className="text-muted text-sm">{esCaja ? 'Te la mostramos por WhatsApp.' : 'Te respondemos por WhatsApp.'}</p>
                            </div>
                            <div className="flex items-start gap-3" role="status">
                                <Character name="nova" height={56} alt="" />
                                <AnimatePresence mode="wait">
                                    <motion.p
                                        key={`${camino}-${campo}`}
                                        initial={reducir ? false : { opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-accent/10 border border-border rounded-2xl rounded-tl-sm px-3 py-2 text-[13px] flex-1"
                                    >
                                        {guia[campo] || guia._}
                                    </motion.p>
                                </AnimatePresence>
                            </div>
                            {!esCaja && interes && (
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
                                <label className={labelCls}>{esCaja ? 'Nombre de tu emprendimiento' : 'Nombre de tu negocio'}</label>
                                <input className={inputCls} value={form.negocio} onChange={set('negocio')} {...foco('negocio')} required maxLength={150} placeholder={esCaja ? 'Ej. Postres de Ana' : 'Ej. Sabores de Mocoa'} />
                            </div>
                            <div>
                                <label className={labelCls}>Tu WhatsApp</label>
                                <input className={inputCls} value={form.whatsapp} onChange={set('whatsapp')} {...foco('whatsapp')} inputMode="tel" autoComplete="tel" required placeholder="300 123 4567" />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={labelCls}>Ciudad</label>
                                    <input className={inputCls} value={form.ciudad} onChange={set('ciudad')} {...foco('ciudad')} autoComplete="address-level2" maxLength={80} placeholder={esCaja ? 'Medellín' : 'Mocoa'} />
                                </div>
                                <div>
                                    <label className={labelCls}>{esCaja ? '¿Qué vendes?' : 'Tipo de negocio'}</label>
                                    <select className={inputCls} value={form.tipo_negocio} onChange={set('tipo_negocio')} {...foco('tipo_negocio')}>
                                        <option value="">Elige uno</option>
                                        {TIPOS[camino].map((t) => <option key={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            {esCaja && (
                                <div className="grid gap-3">
                                    <label className="flex items-center gap-3 text-sm font-semibold text-text cursor-pointer min-h-11">
                                        <input
                                            type="checkbox" checked={estudiante} onChange={(e) => setEstudiante(e.target.checked)}
                                            className="w-5 h-5 accent-[#C62828] shrink-0"
                                        />
                                        <GraduationCap size={18} className="text-accent" aria-hidden="true" /> Soy estudiante universitario
                                    </label>
                                    {estudiante && (
                                        <div>
                                            <label className={labelCls}>¿En qué universidad? <span className="text-muted font-normal">(opcional)</span></label>
                                            <input className={inputCls} value={form.universidad} onChange={set('universidad')} {...foco('universidad')} maxLength={80} placeholder="Ej. Universidad de Antioquia" />
                                        </div>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className={labelCls}>¿Qué te gustaría resolver? <span className="text-muted font-normal">(opcional)</span></label>
                                <textarea
                                    className={inputCls} rows={3} value={form.mensaje} onChange={set('mensaje')} {...foco('mensaje')} maxLength={900}
                                    placeholder={esCaja ? 'Ej. Anoto en un cuaderno y nunca sé cuánto gano' : 'Ej. Me escriben muchos clientes y no alcanzo a responder'}
                                />
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
