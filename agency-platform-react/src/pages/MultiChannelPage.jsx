import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    MessageSquare,
    Send,
    CheckCircle,
    XCircle,
    Loader2,
    ExternalLink,
    Smartphone,
    Camera,
    Bot
} from 'lucide-react';
import { api } from '../services/api';

const MultiChannelPage = () => {
    const navigate = useNavigate();
    const [telegram, setTelegram] = useState({ connected: false, bot_nombre: null });
    const [instagram, setInstagram] = useState({ connected: false, nombre: null });
    const [telegramToken, setTelegramToken] = useState('');
    const [igPageId, setIgPageId] = useState('');
    const [igAccessToken, setIgAccessToken] = useState('');
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(null);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            setLoading(true);
            const [tgRes, igRes] = await Promise.all([
                api.get('/telegram/status').catch(() => ({ data: {} })),
                api.get('/instagram/status').catch(() => ({ data: {} }))
            ]);
            setTelegram(tgRes.data);
            setInstagram(igRes.data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const connectTelegram = async () => {
        if (!telegramToken) return;
        try {
            setConnecting('telegram');
            const res = await api.post('/telegram/connect', { bot_token: telegramToken });
            setTelegram({ connected: true, bot_nombre: res.data.bot.nombre });
            setTelegramToken('');
        } catch (error) {
            alert(error.response?.data?.error || 'Error conectando Telegram');
        } finally {
            setConnecting(null);
        }
    };

    const disconnectTelegram = async () => {
        try {
            await api.post('/telegram/disconnect');
            setTelegram({ connected: false, bot_nombre: null });
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const connectInstagram = async () => {
        if (!igPageId || !igAccessToken) return;
        try {
            setConnecting('instagram');
            const res = await api.post('/instagram/connect', {
                page_id: igPageId,
                access_token: igAccessToken
            });
            setInstagram({ connected: true, nombre: res.data.account.nombre });
            setIgPageId('');
            setIgAccessToken('');
        } catch (error) {
            alert(error.response?.data?.error || 'Error conectando Instagram');
        } finally {
            setConnecting(null);
        }
    };

    const disconnectInstagram = async () => {
        try {
            await api.post('/instagram/disconnect');
            setInstagram({ connected: false, nombre: null });
        } catch (error) {
            console.error('Error:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-bg flex items-center justify-center">
                <Loader2 className="animate-spin text-accent" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg p-6 lg:p-10">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <button aria-label="Volver al dashboard"
                        onClick={() => navigate('/dashboard')}
                        className="tap-44 shrink-0 rounded-xl bg-bg2 border border-border hover:border-accent/30 hover:bg-accent/10 transition-all"
                    >
                        <ArrowLeft className="w-5 h-5 text-muted" />
                    </button>
                    <div>
                        <h1 className="font-head text-3xl font-bold mb-2">Multi-Canal</h1>
                        <p className="text-muted">Conecta tu bot a Telegram e Instagram</p>
                    </div>
                </div>

                {/* WhatsApp Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-3xl p-6 border border-border mb-6"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                            <Smartphone className="w-5 h-5 text-success" />
                        </div>
                        <div>
                            <h2 className="font-bold">WhatsApp Business</h2>
                            <p className="text-sm text-muted">Canal principal activo</p>
                        </div>
                        <div className="ml-auto">
                            <span className="flex items-center gap-1 text-xs text-success bg-success/10 px-3 py-1 rounded-full">
                                <CheckCircle size={12} /> ACTIVO
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* Telegram */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass rounded-3xl p-6 border border-border mb-6"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                            <Send className="w-5 h-5 text-info-text" />
                        </div>
                        <div>
                            <h2 className="font-bold">Telegram Bot</h2>
                            <p className="text-sm text-muted">Automatiza conversaciones en Telegram</p>
                        </div>
                        <div className="ml-auto">
                            {telegram.connected ? (
                                <span className="flex items-center gap-1 text-xs text-success bg-success/10 px-3 py-1 rounded-full">
                                    <CheckCircle size={12} /> {telegram.bot_nombre}
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs text-muted bg-bg3 px-3 py-1 rounded-full">
                                    <XCircle size={12} /> DESCONECTADO
                                </span>
                            )}
                        </div>
                    </div>

                    {telegram.connected ? (
                        <div className="flex gap-2">
                            <a
                                href={`https://t.me/${telegram.bot_nombre?.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-info/10 text-info-text rounded-xl text-sm hover:bg-info/20 transition-all"
                            >
                                <ExternalLink size={14} /> Abrir Bot
                            </a>
                            <button
                                onClick={disconnectTelegram}
                                className="px-4 py-2 bg-danger/10 text-danger-text rounded-xl text-sm hover:bg-danger/20 transition-all"
                            >
                                Desconectar
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-mono text-muted mb-1 block">TOKEN DEL BOT</label>
                                <input
                                    type="text"
                                    value={telegramToken}
                                    onChange={(e) => setTelegramToken(e.target.value)}
                                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                                    className="w-full bg-bg3/50 border border-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-info"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted">
                                <Bot size={14} />
                                <span>Crea tu bot en <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-info-text hover:underline">@BotFather</a></span>
                            </div>
                            <button
                                onClick={connectTelegram}
                                disabled={!telegramToken || connecting === 'telegram'}
                                className="w-full py-2.5 bg-info text-white rounded-xl text-sm font-medium hover:bg-info transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {connecting === 'telegram' ? (
                                    <><Loader2 className="animate-spin" size={16} /> Conectando...</>
                                ) : (
                                    <><Send size={16} /> Conectar Telegram</>
                                )}
                            </button>
                        </div>
                    )}
                </motion.div>

                {/* Instagram */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass rounded-3xl p-6 border border-border mb-6"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                            <Camera className="w-5 h-5 text-pink-500" />
                        </div>
                        <div>
                            <h2 className="font-bold">Instagram Business</h2>
                            <p className="text-sm text-muted">Responde DMs automáticamente</p>
                        </div>
                        <div className="ml-auto">
                            {instagram.connected ? (
                                <span className="flex items-center gap-1 text-xs text-success bg-success/10 px-3 py-1 rounded-full">
                                    <CheckCircle size={12} /> {instagram.nombre}
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs text-muted bg-bg3 px-3 py-1 rounded-full">
                                    <XCircle size={12} /> DESCONECTADO
                                </span>
                            )}
                        </div>
                    </div>

                    {instagram.connected ? (
                        <div className="flex gap-2">
                            <button
                                onClick={disconnectInstagram}
                                className="px-4 py-2 bg-danger/10 text-danger-text rounded-xl text-sm hover:bg-danger/20 transition-all"
                            >
                                Desconectar
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-mono text-muted mb-1 block">PAGE ID</label>
                                <input
                                    type="text"
                                    value={igPageId}
                                    onChange={(e) => setIgPageId(e.target.value)}
                                    placeholder="123456789"
                                    className="w-full bg-bg3/50 border border-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-pink-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-mono text-muted mb-1 block">ACCESS TOKEN</label>
                                <input
                                    type="password"
                                    value={igAccessToken}
                                    onChange={(e) => setIgAccessToken(e.target.value)}
                                    placeholder="EAAxxxxxxxxxxxxxxx"
                                    className="w-full bg-bg3/50 border border-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-pink-500"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted">
                                <Camera size={14} />
                                <span>Necesitas una cuenta Business conectada a Facebook</span>
                            </div>
                            <button
                                onClick={connectInstagram}
                                disabled={!igPageId || !igAccessToken || connecting === 'instagram'}
                                className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {connecting === 'instagram' ? (
                                    <><Loader2 className="animate-spin" size={16} /> Conectando...</>
                                ) : (
                                    <><Camera size={16} /> Conectar Instagram</>
                                )}
                            </button>
                        </div>
                    )}
                </motion.div>

                {/* Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="glass rounded-3xl p-6 border border-border"
                >
                    <h3 className="font-bold mb-3">¿Cómo funciona?</h3>
                    <div className="space-y-2 text-sm text-muted">
                        <p>• <strong>WhatsApp:</strong> Canal principal para ventas y pedidos</p>
                        <p>• <strong>Telegram:</strong> Ideal para soporte y notificaciones</p>
                        <p>• <strong>Instagram:</strong> Responde DMs y genera leads</p>
                        <p className="mt-3 text-xs">Todos los canales usan la misma IA y se sincronizan en un solo dashboard.</p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default MultiChannelPage;
