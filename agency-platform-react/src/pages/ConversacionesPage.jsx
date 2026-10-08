import TipNova from '../components/TipNova';
import EmptyState from '../components/EmptyState';
import { Character } from '../components/Illustration';
import React, { useState, useEffect } from 'react';
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
    AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

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

    useEffect(() => {
        fetchConversaciones();
    }, []);

    const fetchConversaciones = async () => {
        try {
            setError('');
            setLoading(true);
            const response = await api.get('/conversaciones', { params: { buscar } });
            setConversaciones(response.data.conversaciones || []);
        } catch (error) {
            console.error('Error:', error);
            setError('Error al cargar conversaciones');
        } finally {
            setLoading(false);
        }
    };

    const fetchMensajes = async (convId) => {
        try {
            setLoadingMensajes(true);
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
        fetchMensajes(conv.id);
    };

    const handleEnviarMensaje = async (e) => {
        e.preventDefault();
        if (!nuevoMensaje.trim() || !selectedConv) return;

        try {
            setEnviando(true);
            await api.post(`/conversaciones/${selectedConv.id}/mensaje`, { contenido: nuevoMensaje });
            setNuevoMensaje('');
            fetchMensajes(selectedConv.id);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setEnviando(false);
        }
    };

    const handleBuscar = (e) => {
        e.preventDefault();
        fetchConversaciones();
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="h-screen bg-bg flex">
            {/* Lista de conversaciones */}
            <div className={`w-full md:w-96 bg-bg2 border-r border-border flex flex-col ${selectedConv ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-border">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 rounded-xl bg-bg border border-border hover:border-accent/30 hover:bg-accent/10 transition-all"
                        >
                            <ArrowLeft className="w-4 h-4 text-muted" />
                        </button>
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
                <TipNova id="conversaciones" className="m-3">Aquí ves todo lo que tu bot conversa con tus clientes, con su historial completo.</TipNova>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin text-accent" size={24} />
                        </div>
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
                        conversaciones.map((conv) => (
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
                                            <span className="font-bold text-sm truncate">
                                                {conv.cliente_nombre || conv.numero_cliente || 'Desconocido'}
                                            </span>
                                            <span className="text-xs text-muted flex items-center gap-1">
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
                                <p className="text-xs text-muted">{selectedConv.numero_cliente}</p>
                            </div>
                        </div>

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
                            <form onSubmit={handleEnviarMensaje} className="flex gap-2">
                                <input
                                    type="text"
                                    value={nuevoMensaje}
                                    onChange={(e) => setNuevoMensaje(e.target.value)}
                                    placeholder="Escribe un mensaje..."
                                    className="flex-1 bg-bg/50 border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-accent"
                                    disabled={enviando}
                                />
                                <button 
                                    type="submit" 
                                    disabled={enviando || !nuevoMensaje.trim()}
                                    className="bg-accent text-bg px-6 py-3 rounded-xl font-bold disabled:opacity-50"
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
