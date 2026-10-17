import { mensajeError } from '../utils/errores';
import TipNova from '../components/TipNova';
import EmptyState from '../components/EmptyState';
import { Character } from '../components/Illustration';
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
    MessageSquare, 
    Search, 
    Send, 
    ArrowLeft,
    Phone,
    Clock,
    Loader2,
    AlertCircle,
    Plus,
    X,
    Pin,
    ShoppingCart
} from 'lucide-react';
import { api } from '../services/api';
import { usePedidosLive } from '../context/PedidosLiveContext';
import { SkeletonList } from '../components/Skeleton';

// Estado de la bandeja guardado en este dispositivo: qué chats ya se leyeron y cuáles están anclados.
const leerLS = (clave, vacio) => {
    try { return JSON.parse(localStorage.getItem(clave) || 'null') ?? vacio; } catch { return vacio; }
};
const guardarLS = (clave, valor) => {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
};
const soloDigitos = (t) => String(t || '').replace(/\D/g, '');
const ETIQUETA_ESTADO = {
    pendiente_pago: 'Por pagar', pago_enviado: 'Comprobante', pago_confirmado: 'Pagado', en_preparacion: 'Preparando',
    enviado: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado',
};

const RESPUESTAS_BASE = [
    '¡Hola! Con gusto te ayudo. ¿Qué necesitas?',
    'Ya reviso tu pedido y te confirmo en un momento.',
    'Recibimos tu pago, ¡gracias! Ya lo estamos preparando.',
    'Tu pedido va en camino.',
];

const ConversacionesPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [conversaciones, setConversaciones] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [mensajes, setMensajes] = useState([]);
    const [nuevoMensaje, setNuevoMensaje] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMensajes, setLoadingMensajes] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [buscar, setBuscar] = useState('');
    const [error, setError] = useState('');

    const { suscribir } = usePedidosLive();
    const [respuestas, setRespuestas] = useState(() => {
        try { return JSON.parse(localStorage.getItem('noma_respuestas_rapidas') || 'null') || RESPUESTAS_BASE; } catch { return RESPUESTAS_BASE; }
    });
    const guardarRespuestas = (lista) => {
        setRespuestas(lista);
        try { localStorage.setItem('noma_respuestas_rapidas', JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
    };
    const selRef = useRef(null);
    selRef.current = selectedConv;

    // Bandeja: leídos, anclados, filtros y pedidos del cliente abierto
    const [leidas, setLeidas] = useState(() => leerLS('noma_conv_leidas', null));
    const [ancladas, setAncladas] = useState(() => leerLS('noma_conv_ancladas', []));
    const [filtro, setFiltro] = useState('todas');
    const [pedidosCliente, setPedidosCliente] = useState(null);
    const [verPedidos, setVerPedidos] = useState(false);
    const marcarLeida = (conv) => {
        setLeidas((prev) => {
            const sig = { ...(prev || {}), [conv.id]: conv.ultimo_mensaje_at || new Date().toISOString() };
            guardarLS('noma_conv_leidas', sig);
            return sig;
        });
    };
    const alternarAncla = (id) => {
        setAncladas((prev) => {
            const sig = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
            guardarLS('noma_conv_ancladas', sig);
            return sig;
        });
    };
    const sinLeer = (conv) => {
        if (!leidas) return false;
        const visto = leidas[conv.id];
        if (!visto) return true;
        return new Date(conv.ultimo_mensaje_at).getTime() > new Date(visto).getTime();
    };

    useEffect(() => {
        fetchConversaciones();
    }, []);

    // Mensaje nuevo: refresca la lista y, si es el chat abierto, también sus mensajes.
    useEffect(() => suscribir('mensajes', () => {
        fetchConversaciones(true);
        if (selRef.current) fetchMensajes(selRef.current.id, true);
    }), [suscribir]);

    const fetchConversaciones = async (silencioso = false) => {
        try {
            setError('');
            if (!silencioso) setLoading(true);
            const response = await api.get('/conversaciones', { params: { buscar } });
            const lista = response.data.conversaciones || [];
            setConversaciones(lista);
            // Primera vez en este dispositivo: todo lo existente cuenta como leído (si no, todo saldría "sin leer")
            setLeidas((prev) => {
                if (prev) return prev;
                const semilla = Object.fromEntries(lista.map((c) => [c.id, c.ultimo_mensaje_at || new Date().toISOString()]));
                guardarLS('noma_conv_leidas', semilla);
                return semilla;
            });
        } catch (error) {
            console.error('Error:', error);
            setError('Error al cargar conversaciones');
        } finally {
            setLoading(false);
        }
    };

    const fetchMensajes = async (convId, silencioso = false) => {
        try {
            if (!silencioso) setLoadingMensajes(true);
            const response = await api.get(`/conversaciones/${convId}/mensajes`);
            setMensajes(response.data || []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoadingMensajes(false);
        }
    };

    const handleSelectConv = (conv) => {
        setSelectedConv(conv);
        setVerPedidos(false);
        marcarLeida(conv);
        fetchMensajes(conv.id);
    };

    // Pedidos del cliente del chat abierto (se cruzan por número de WhatsApp)
    const abrirPedidos = async () => {
        const abrir = !verPedidos;
        setVerPedidos(abrir);
        if (abrir && pedidosCliente === null) {
            try {
                const r = await api.get('/pedidos');
                setPedidosCliente(r.data?.pedidos || []);
            } catch {
                setPedidosCliente([]);
            }
        }
    };
    const pedidosDeEste = selectedConv && pedidosCliente
        ? pedidosCliente.filter((p) => {
            const a = soloDigitos(p.cliente_whatsapp);
            const b = soloDigitos(selectedConv.numero_cliente || selectedConv.cliente_whatsapp);
            return a && b && (a.endsWith(b.slice(-10)) || b.endsWith(a.slice(-10)));
        }).slice(0, 4)
        : [];

    const [errorEnvio, setErrorEnvio] = useState('');

    const cambiarAtencionLocal = (valor) => {
        setSelectedConv((c) => (c ? { ...c, atencion_humana: valor } : c));
        setConversaciones((lista) => lista.map((c) => (c.id === selectedConv?.id ? { ...c, atencion_humana: valor } : c)));
    };

    // "Retomar bot" devuelve el chat al bot; "Atender yo" lo pone en manos de una persona.
    const cambiarAtencion = async (humano) => {
        try {
            await api.post(`/conversaciones/${selectedConv.id}/${humano ? 'tomar' : 'retomar-bot'}`);
            cambiarAtencionLocal(humano ? 1 : 0);
        } catch (error) {
            setErrorEnvio(mensajeError(error, 'cambiar el modo de atención'));
        }
    };

    const handleEnviarMensaje = async (e) => {
        e.preventDefault();
        if (!nuevoMensaje.trim() || !selectedConv) return;

        try {
            setEnviando(true);
            await api.post(`/conversaciones/${selectedConv.id}/mensaje`, { contenido: nuevoMensaje });
            setNuevoMensaje('');
            // Al escribir tú, el bot se hace a un lado de este chat.
            cambiarAtencionLocal(1);
            fetchMensajes(selectedConv.id);
        } catch (error) {
            console.error('Error:', error);
            setErrorEnvio(mensajeError(error, 'enviar el mensaje'));
        } finally {
            setEnviando(false);
        }
    };

    const handleBuscar = (e) => {
        e.preventDefault();
        fetchConversaciones();
    };

    const conteo = {
        todas: conversaciones.length,
        sin_leer: conversaciones.filter(sinLeer).length,
        atencion: conversaciones.filter((c) => c.atencion_humana).length,
        ancladas: conversaciones.filter((c) => ancladas.includes(c.id)).length,
    };
    const listaVisible = conversaciones
        .filter((c) => (
            filtro === 'sin_leer' ? sinLeer(c)
            : filtro === 'atencion' ? c.atencion_humana
            : filtro === 'ancladas' ? ancladas.includes(c.id)
            : true
        ))
        .sort((a, b) => Number(ancladas.includes(b.id)) - Number(ancladas.includes(a.id)));

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="bg-bg flex alto-pantalla">
            {/* Lista de conversaciones */}
            <div className={`w-full md:w-96 bg-bg2 border-r border-border flex flex-col ${selectedConv ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-border">
                    <div className="flex items-center gap-3 mb-4">
                        <h2 className="font-head text-xl font-bold">Conversaciones</h2>
                    </div>
                    <form onSubmit={handleBuscar} className="flex gap-2">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                            <input
                                type="text"
                                value={buscar}
                                onChange={(e) => setBuscar(e.target.value)}
                                placeholder="Buscar por nombre o número..."
                                className="w-full bg-bg/50 border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
                            />
                        </div>
                        <button type="submit" className="bg-accent text-bg px-4 py-2 rounded-xl text-sm font-bold">
                            Buscar
                        </button>
                    </form>
                </div>
                <div className="flex gap-2 overflow-x-auto px-3 py-2 border-b border-border" role="tablist" aria-label="Filtrar chats">
                    {[['todas', 'Todos'], ['sin_leer', 'Sin leer'], ['atencion', 'Requiere atención'], ['ancladas', 'Anclados']].map(([id, label]) => (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={filtro === id}
                            onClick={() => setFiltro(id)}
                            className={`shrink-0 h-9 px-3 rounded-full text-xs font-semibold border-none cursor-pointer ${filtro === id ? 'bg-accent text-white' : 'bg-white text-muted border border-border'}`}
                        >
                            {label} <span className="font-mono opacity-80">{conteo[id]}</span>
                        </button>
                    ))}
                </div>
                <TipNova id="conversaciones" className="m-3">Aquí ves todo lo que tu bot conversa con tus clientes, con su historial completo.</TipNova>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-3"><SkeletonList filas={6} /></div>
                    ) : error && conversaciones.length === 0 ? (
                        <EmptyState
                            name="error"
                            size={130}
                            title="No pudimos cargar tus conversaciones"
                            description={error}
                            action={<button onClick={fetchConversaciones} className="h-11 px-5 rounded-xl bg-accent text-white text-sm font-semibold border-none cursor-pointer hover:bg-accent2 transition-colors">Reintentar</button>}
                        />
                    ) : conversaciones.length === 0 ? (
                        <div className="flex flex-col items-center text-center py-12 px-4">
                            <div className="w-[130px] h-[130px] rounded-2xl bg-[#FDECEA] flex items-end justify-center overflow-hidden">
                                <Character name="lucia" height={140} alt="Lucía, encargada de la atención al cliente" />
                            </div>
                            <h3 className="text-xl font-bold mt-6 mb-2">No hay conversaciones aún</h3>
                            <p className="text-muted text-sm max-w-md">Cuando un cliente escriba a tu bot, Lucía te lo avisa aquí con todo el historial.</p>
                        </div>
                    ) : (
                        listaVisible.length === 0 ? (
                            <p className="text-center text-sm text-muted py-10 m-0">No hay chats en este filtro.</p>
                        ) : listaVisible.map((conv) => (
                            <motion.div
                                key={conv.id}
                                whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                                onClick={() => handleSelectConv(conv)}
                                className={`p-4 border-b border-border cursor-pointer transition-all ${selectedConv?.id === conv.id ? 'bg-accent/5 border-l-2 border-l-accent' : ''}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Phone className="text-accent" size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-sm truncate ${sinLeer(conv) ? 'font-extrabold' : 'font-bold'}`}>
                                                {sinLeer(conv) && <span aria-label="Sin leer" className="inline-block w-2 h-2 rounded-full bg-accent mr-1.5 align-middle" />}
                                                {conv.cliente_nombre || conv.numero_cliente || 'Desconocido'}
                                                {conv.atencion_humana ? <span className="ml-2 text-[10px] font-semibold text-warn-text bg-warn/10 px-1.5 py-0.5 rounded">Requiere atención</span> : null}
                                            </span>
                                            <span className="text-xs text-muted flex items-center gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); alternarAncla(conv.id); }}
                                                    aria-label={ancladas.includes(conv.id) ? 'Quitar de anclados' : 'Anclar chat'}
                                                    aria-pressed={ancladas.includes(conv.id)}
                                                    className={`w-8 h-8 -my-2 flex items-center justify-center bg-transparent border-none cursor-pointer ${ancladas.includes(conv.id) ? 'text-accent' : 'text-muted/50 hover:text-muted'}`}
                                                >
                                                    <Pin size={14} className={ancladas.includes(conv.id) ? 'fill-current' : ''} />
                                                </button>
                                                <Clock size={12} />
                                                {formatTime(conv.ultimo_mensaje_at)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted truncate">
                                            {conv.ultimo_mensaje || 'Sin mensajes'}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            {/* Panel de聊天 */}
            <div className={`flex-1 flex flex-col ${selectedConv ? 'flex' : 'hidden md:flex'}`}>
                {selectedConv ? (
                    <>
                        {/* Header */}
                        <div className="h-16 bg-bg2 border-b border-border flex items-center px-4 gap-4">
                            <button 
                                onClick={() => setSelectedConv(null)}
                                className="md:hidden text-muted hover:text-text"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                                <Phone className="text-accent" size={16} />
                            </div>
                            <div>
                                <p className="font-bold text-sm">
                                    {selectedConv.cliente_nombre || selectedConv.numero_cliente || 'Desconocido'}
                                </p>
                                <p className="text-xs text-muted">{selectedConv.numero_cliente || selectedConv.cliente_whatsapp}</p>
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                                <button
                                    onClick={abrirPedidos}
                                    aria-pressed={verPedidos}
                                    className={`h-9 px-3 rounded-xl border text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 ${verPedidos ? 'bg-accent-dim border-accent/40 text-accent' : 'bg-bg border-border text-text'}`}
                                >
                                    <ShoppingCart size={14} /> <span className="hidden sm:inline">Pedidos</span>
                                </button>
                                {selectedConv.atencion_humana ? (
                                    <>
                                        <span className="hidden sm:inline text-xs font-semibold text-warn-text bg-warn/10 px-2 py-1 rounded-lg">
                                            Atiendes tú · el bot está en pausa
                                        </span>
                                        <button
                                            onClick={() => cambiarAtencion(false)}
                                            className="h-9 px-3 rounded-xl bg-accent text-white text-xs font-semibold border-none cursor-pointer"
                                        >
                                            Retomar bot
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => cambiarAtencion(true)}
                                        className="h-9 px-3 rounded-xl bg-bg border border-border text-text text-xs font-semibold cursor-pointer"
                                    >
                                        Atender yo
                                    </button>
                                )}
                            </div>
                        </div>
                        {verPedidos && (
                            <div className="border-b border-border bg-bg px-4 py-3" aria-label="Pedidos de este cliente">
                                {pedidosCliente === null ? (
                                    <p className="text-xs text-muted m-0">Buscando pedidos…</p>
                                ) : pedidosDeEste.length === 0 ? (
                                    <p className="text-xs text-muted m-0">Este cliente aún no tiene pedidos.</p>
                                ) : (
                                    <ul className="list-none m-0 p-0 space-y-1.5">
                                        {pedidosDeEste.map((p) => (
                                            <li key={p.id}>
                                                <button
                                                    onClick={() => navigate(`/pedidos?q=${encodeURIComponent(p.numero_pedido || p.id)}`)}
                                                    className="w-full flex items-center gap-3 text-left bg-white border border-border rounded-xl px-3 min-h-[44px] cursor-pointer"
                                                >
                                                    <span className="font-mono text-sm font-bold">#{p.numero_pedido || p.id}</span>
                                                    <span className="text-xs text-muted flex-1">{ETIQUETA_ESTADO[p.estado] || p.estado}</span>
                                                    <span className="font-mono text-sm text-accent font-bold">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(p.total || 0)}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                        {errorEnvio && (
                            <div role="alert" className="px-4 py-2 text-xs bg-danger/10 text-danger flex justify-between">
                                <span>{errorEnvio}</span>
                                <button onClick={() => setErrorEnvio('')} className="bg-transparent border-none text-danger cursor-pointer">×</button>
                            </div>
                        )}

                        {/* Mensajes */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {loadingMensajes ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="animate-spin text-accent" size={24} />
                                </div>
                            ) : mensajes.length === 0 ? (
                                <EmptyState character="lucia" size={130} title="No hay mensajes" description="Esta conversación todavía no tiene mensajes." />
                            ) : (
                                mensajes.map((msg) => (
                                    <div 
                                        key={msg.id}
                                        className={`flex ${msg.tipo === 'salida' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[70%] p-3 rounded-2xl ${
                                            msg.tipo === 'salida' 
                                                ? 'bg-accent text-bg rounded-br-md' 
                                                : 'bg-bg2 border border-border rounded-bl-md'
                                        }`}>
                                            <p className="text-sm">{msg.contenido}</p>
                                            <p className={`text-xs mt-1 ${msg.tipo === 'salida' ? 'text-bg/70' : 'text-muted'}`}>
                                                {formatTime(msg.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-4 bg-bg2 border-t border-border">
                            <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1" aria-label="Respuestas rápidas">
                                {respuestas.map((r, i) => (
                                    <span key={i} className="shrink-0 inline-flex items-center rounded-full bg-white border border-border">
                                        <button
                                            type="button"
                                            onClick={() => setNuevoMensaje(r)}
                                            title={r}
                                            className="h-9 pl-3 pr-2 max-w-[220px] truncate text-xs font-medium text-text bg-transparent border-none cursor-pointer"
                                        >
                                            {r}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => guardarRespuestas(respuestas.filter((_, j) => j !== i))}
                                            aria-label="Quitar respuesta rápida"
                                            className="w-7 h-9 flex items-center justify-center text-muted bg-transparent border-none cursor-pointer"
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                                <button
                                    type="button"
                                    disabled={!nuevoMensaje.trim() || respuestas.includes(nuevoMensaje.trim())}
                                    onClick={() => guardarRespuestas([...respuestas, nuevoMensaje.trim()])}
                                    title="Guardar lo que escribiste como respuesta rápida"
                                    className="shrink-0 h-9 px-3 rounded-full border border-dashed border-border text-xs font-semibold text-muted bg-transparent cursor-pointer inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Plus size={12} /> Guardar
                                </button>
                            </div>
                            <form onSubmit={handleEnviarMensaje} className="flex gap-2">
                                <input
                                    type="text"
                                    value={nuevoMensaje}
                                    onChange={(e) => setNuevoMensaje(e.target.value)}
                                    placeholder="Escribe un mensaje..."
                                    className="flex-1 bg-bg border border-border rounded-xl h-12 px-4 text-base md:text-sm focus:outline-none focus:border-accent"
                                    disabled={enviando}
                                />
                                <button 
                                    type="submit" 
                                    disabled={enviando || !nuevoMensaje.trim()}
                                    aria-label="Enviar mensaje"
                                    title={!nuevoMensaje.trim() ? 'Escribe un mensaje para poder enviarlo' : undefined}
                                    className="bg-accent text-white min-w-[48px] h-12 px-5 rounded-xl font-bold disabled:opacity-50"
                                >
                                    {enviando ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <MessageSquare className="mx-auto mb-4 text-muted" size={64} />
                            <h3 className="text-xl font-bold mb-2">Selecciona una conversación</h3>
                            <p className="text-muted">Elige una conversación de la izquierda para ver los mensajes</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConversacionesPage;
