import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Phone,
    PhoneOff,
    Mic,
    MicOff,
    Volume2,
    VolumeX,
    Settings,
    Play,
    Pause,
    Save,
    Loader2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    PhoneCall,
    Clock,
    TrendingUp,
    Users,
    Settings2,
    AudioWaveform
} from 'lucide-react';
import { api } from '../services/api';

const VoiceBotPage = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState(null);
    const [config, setConfig] = useState({
        habilitado: false,
        greeting_message: '¡Hola! Soy tu asistente virtual. ¿Qué desea ordenar?',
        farewell_message: '¡Gracias por llamar! ¡Hasta pronto!',
        language: 'es',
        temperature: 0.8,
        speed: 1.0,
        max_call_duration: 300,
        voice_id: null
    });
    const [voices, setVoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testMode, setTestMode] = useState(false);
    const [testText, setTestText] = useState('¡Hola! Bienvenido a nuestro restaurante. ¿Qué te gustaría ordenar?');
    const [testAudio, setTestAudio] = useState(null);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        fetchStatus();
        fetchConfig();
        fetchVoices();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await api.get('/voice/status');
            setStatus(res.data);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await api.get('/voice/config');
            if (res.data) {
                setConfig(prev => ({ ...prev, ...res.data }));
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const fetchVoices = async () => {
        try {
            const res = await api.get('/voice/voices');
            setVoices(res.data || []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async () => {
        try {
            setSaving(true);
            await api.post('/voice/config', config);
            alert('Configuración guardada');
        } catch (error) {
            alert('Error guardando configuración');
        } finally {
            setSaving(false);
        }
    };

    const testTTS = async () => {
        if (!testText.trim()) return;
        
        try {
            setGenerating(true);
            const res = await api.post('/voice/text-to-speech', {
                text: testText,
                voiceId: config.voice_id,
                language: config.language,
                temperature: config.temperature
            });
            setTestAudio(res.data.audio);
        } catch (error) {
            alert('Error generando audio: ' + error.message);
        } finally {
            setGenerating(false);
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
                        <h1 className="font-head text-3xl font-bold mb-2">Bot de Llamadas</h1>
                        <p className="text-muted">Automatiza las llamadas telefónicas con IA</p>
                    </div>
                </div>

                {/* Estado del Sistema */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-3xl p-6 border border-border mb-6"
                >
                    <h2 className="font-bold mb-4 flex items-center gap-2">
                        <PhoneCall size={20} /> Estado del Sistema
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Clonar-voz */}
                        <div className={`p-4 rounded-xl ${status?.clonarVoz?.online ? 'bg-success/10 border border-success/30' : 'bg-danger/10 border border-danger/30'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                {status?.clonarVoz?.online ? (
                                    <CheckCircle className="text-success" size={18} />
                                ) : (
                                    <XCircle className="text-danger-text" size={18} />
                                )}
                                <span className="font-medium">Clonar-voz</span>
                            </div>
                            <p className="text-xs text-muted">
                                {status?.clonarVoz?.online ? 'TTS Local Activo' : 'No conectado'}
                            </p>
                        </div>

                        {/* Twilio */}
                        <div className={`p-4 rounded-xl ${status?.twilio?.configured ? 'bg-success/10 border border-success/30' : 'bg-warn/10 border border-warn/30'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                {status?.twilio?.configured ? (
                                    <CheckCircle className="text-success" size={18} />
                                ) : (
                                    <AlertTriangle className="text-warn-text" size={18} />
                                )}
                                <span className="font-medium">Twilio</span>
                            </div>
                            <p className="text-xs text-muted">
                                {status?.twilio?.phoneNumber || 'No configurado'}
                            </p>
                        </div>

                        {/* STT Provider */}
                        <div className={`p-4 rounded-xl ${status?.stt?.configured ? 'bg-success/10 border border-success/30' : 'bg-warn/10 border border-warn/30'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                {status?.stt?.configured ? (
                                    <CheckCircle className="text-success" size={18} />
                                ) : (
                                    <AlertTriangle className="text-warn-text" size={18} />
                                )}
                                <span className="font-medium">STT ({status?.stt?.provider || 'whisper_local'})</span>
                            </div>
                            <p className="text-xs text-muted">
                                {status?.stt?.info || 'No configurado'}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Configuración Principal */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass rounded-3xl p-6 border border-border mb-6"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold flex items-center gap-2">
                            <Settings size={20} /> Configuración
                        </h2>
                        <button
                            onClick={() => setConfig(prev => ({ ...prev, habilitado: !prev.habilitado }))}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                config.habilitado 
                                    ? 'bg-success text-white' 
                                    : 'bg-bg3 text-muted'
                            }`}
                        >
                            {config.habilitado ? 'ACTIVADO' : 'DESACTIVADO'}
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Mensajes */}
                        <div>
                            <label className="text-xs font-mono text-muted mb-1 block">MENSAJE DE BIENVENIDA</label>
                            <textarea
                                value={config.greeting_message}
                                onChange={(e) => setConfig(prev => ({ ...prev, greeting_message: e.target.value }))}
                                className="w-full bg-bg3/50 border border-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-accent h-20"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-mono text-muted mb-1 block">MENSAJE DE DESPEDIDA</label>
                            <textarea
                                value={config.farewell_message}
                                onChange={(e) => setConfig(prev => ({ ...prev, farewell_message: e.target.value }))}
                                className="w-full bg-bg3/50 border border-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-accent h-20"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-mono text-muted mb-1 block">IDIOMA</label>
                                <select
                                    value={config.language}
                                    onChange={(e) => setConfig(prev => ({ ...prev, language: e.target.value }))}
                                    className="w-full bg-bg3/50 border border-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-accent"
                                >
                                    <option value="es">Español</option>
                                    <option value="en">Inglés</option>
                                    <option value="pt">Portugués</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-mono text-muted mb-1 block">TEMPERATURA ({config.temperature})</label>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="1.5"
                                    step="0.1"
                                    value={config.temperature}
                                    onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                                    className="w-full accent-accent"
                                />
                                <div className="flex justify-between text-xs text-muted mt-1">
                                    <span>Estable</span>
                                    <span>Expresivo</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-mono text-muted mb-1 block">VELOCIDAD ({config.speed})</label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2.0"
                                    step="0.1"
                                    value={config.speed}
                                    onChange={(e) => setConfig(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                                    className="w-full accent-accent"
                                />
                                <div className="flex justify-between text-xs text-muted mt-1">
                                    <span>Lento</span>
                                    <span>Rápido</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={saveConfig}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-all disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                Guardar Configuración
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Voces Personalizadas */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass rounded-3xl p-6 border border-border mb-6"
                >
                    <h2 className="font-bold mb-4 flex items-center gap-2">
                        <AudioWaveform size={20} /> Voces Personalizadas
                    </h2>
                    
                    {voices.length > 0 ? (
                        <div className="space-y-2">
                            {voices.map((voice) => (
                                <div
                                    key={voice.id}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                        config.voice_id === voice.id
                                            ? 'border-accent bg-accent/10'
                                            : 'border-border hover:border-accent/30'
                                    }`}
                                    onClick={() => setConfig(prev => ({ ...prev, voice_id: voice.id }))}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                                                <Mic className="w-5 h-5 text-accent" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{voice.nombre}</p>
                                                <p className="text-xs text-muted">{voice.duracion}s de referencia</p>
                                            </div>
                                        </div>
                                        {config.voice_id === voice.id && (
                                            <CheckCircle className="text-accent" size={18} />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted">
                            <Mic size={32} className="mx-auto mb-3 opacity-50" />
                            <p>No hay voces personalizadas</p>
                            <p className="text-xs mt-1">Sube un audio de referencia en Clonar-voz</p>
                        </div>
                    )}
                </motion.div>

                {/* Prueba de Voz */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="glass rounded-3xl p-6 border border-border"
                >
                    <h2 className="font-bold mb-4 flex items-center gap-2">
                        <Volume2 size={20} /> Prueba de Voz
                    </h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-mono text-muted mb-1 block">TEXTO PARA PROBAR</label>
                            <textarea
                                value={testText}
                                onChange={(e) => setTestText(e.target.value)}
                                className="w-full bg-bg3/50 border border-border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-accent h-24"
                                placeholder="Escribe el texto que quieres que el bot diga..."
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={testTTS}
                                disabled={generating || !testText.trim()}
                                className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-all disabled:opacity-50"
                            >
                                {generating ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <Play size={16} />
                                )}
                                Generar Audio
                            </button>

                            {testAudio && (
                                <audio controls className="flex-1">
                                    <source src={testAudio} type="audio/wav" />
                                </audio>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mt-6 p-4 rounded-xl bg-accent/5 border border-accent/20"
                >
                    <h3 className="font-bold text-accent mb-2">¿Cómo funciona?</h3>
                    <div className="text-sm text-muted space-y-1">
                        <p>1. El cliente llama a tu número de Twilio</p>
                        <p>2. El bot saluda y espera la orden del cliente</p>
                        <p>3. Whisper convierte la voz a texto</p>
                        <p>4. La IA procesa el pedido</p>
                        <p>5. Clonar-voz genera la respuesta con voz natural</p>
                        <p>6. El bot confirma el pedido y envía detalles por WhatsApp</p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default VoiceBotPage;
