import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import api from '../services/api';
import {
  Smartphone,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  QrCode,
  Wifi,
  WifiOff,
  Phone,
  Shield,
  Zap,
  Clock,
  Activity,
  AlertTriangle,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
const SOCKET_URL = API_URL.replace('/api', '');

export default function WhatsAppConnectionPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ conectado: false, numero: null });
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [connectedSince, setConnectedSince] = useState(null);
  const [elapsed, setElapsed] = useState('');
  const socketRef = useRef(null);
  const pollingRef = useRef(null);
  const statusPollRef = useRef(null);

  const addEvent = useCallback((type, message) => {
    const now = new Date();
    const time = now.toLocaleTimeString('es-CO');
    setEvents(prev => [{ type, message, time }, ...prev].slice(0, 20));
  }, []);

  useEffect(() => {
    fetchStatus();
    connectSocket();
    startStatusPolling();
    return () => {
      socketRef.current?.disconnect();
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (statusPollRef.current) clearInterval(statusPollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!status.conectado || !connectedSince) {
      setElapsed('');
      return;
    }
    const interval = setInterval(() => {
      const diff = Date.now() - connectedSince;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [status.conectado, connectedSince]);

  function startStatusPolling() {
    if (statusPollRef.current) clearInterval(statusPollRef.current);
    statusPollRef.current = setInterval(async () => {
      try {
        const res = await api.get('/whatsapp/status');
        const newConectado = res.data.conectado;
        if (newConectado && !status.conectado) {
          addEvent('connected', 'Bot conectado');
          setConnectedSince(Date.now());
        } else if (!newConectado && status.conectado) {
          addEvent('disconnected', 'Bot desconectado');
          setConnectedSince(null);
        }
        setStatus(prev => ({ ...prev, ...res.data }));
        if (newConectado) setQr(null);
        else if (res.data.qr_data) setQr(res.data.qr_data);
      } catch {}
    }, 3000);
  }

  function connectSocket() {
    try {
      const socket = io(SOCKET_URL, {
        auth: { token: localStorage.getItem('antigravity_token') },
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        const user = JSON.parse(localStorage.getItem('antigravity_user'));
        if (user?.id) socket.emit('suscribirse_whatsapp', user.id);
        addEvent('system', 'Conectado al servidor');
      });

      socket.on('disconnect', () => {
        addEvent('error', 'Desconectado del servidor');
      });

      socket.on('qr_update', (data) => {
        if (data.qr_data) {
          setQr(data.qr_data);
          setConnecting(false);
          addEvent('qr', 'Nuevo código QR generado');
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      });

      socket.on('whatsapp_status', (data) => {
        if (data.conectado) {
          setStatus(prev => ({ ...prev, conectado: true, numero: data.numero || prev.numero }));
          setQr(null);
          setConnecting(false);
          setConnectedSince(Date.now());
          addEvent('connected', 'WhatsApp conectado');
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else {
          setStatus(prev => ({ ...prev, conectado: false, numero: null }));
          setConnectedSince(null);
          addEvent('disconnected', 'WhatsApp desconectado');
        }
      });

      socket.on('connect_error', (err) => {
        addEvent('error', `Error socket: ${err.message}`);
      });
    } catch (err) {
      addEvent('error', 'Error al conectar socket');
    }
  }

  async function fetchStatus() {
    try {
      setLoading(true);
      const res = await api.get('/whatsapp/status');
      setStatus(res.data);
      if (res.data.qr_data) setQr(res.data.qr_data);
      if (res.data.conectado) {
        addEvent('connected', 'WhatsApp ya estaba conectado');
        setConnectedSince(Date.now());
      }
    } catch (err) {
      addEvent('error', 'Error al obtener estado');
    } finally {
      setLoading(false);
    }
  }

  function startPolling() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    let attempts = 0;
    pollingRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        clearInterval(pollingRef.current);
        setConnecting(false);
        setError('Tiempo de espera agotado. Intenta de nuevo.');
        addEvent('error', 'Timeout esperando QR');
        return;
      }
      try {
        const res = await api.get('/whatsapp/qr');
        if (res.data.qr_data) {
          setQr(res.data.qr_data);
          setConnecting(false);
          clearInterval(pollingRef.current);
          addEvent('qr', 'QR recibido');
          return;
        }
        const statusRes = await api.get('/whatsapp/status');
        if (statusRes.data.conectado) {
          setStatus(statusRes.data);
          setQr(null);
          setConnecting(false);
          clearInterval(pollingRef.current);
          setConnectedSince(Date.now());
          addEvent('connected', 'Conectado exitosamente');
        }
      } catch {}
    }, 2000);
  }

  async function handleConnect() {
    try {
      setConnecting(true);
      setError('');
      setQr(null);
      addEvent('system', 'Iniciando conexión...');
      const res = await api.post('/whatsapp/connect');
      if (res.data.ya_conectado) {
        setStatus(prev => ({ ...prev, conectado: true, numero: res.data.numero }));
        setConnecting(false);
        setConnectedSince(Date.now());
        addEvent('connected', 'Ya estaba conectado');
      } else {
        startPolling();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al conectar');
      setConnecting(false);
      addEvent('error', err.response?.data?.error || 'Error al conectar');
    }
  }

  async function handleDisconnect() {
    try {
      if (pollingRef.current) clearInterval(pollingRef.current);
      await api.post('/whatsapp/disconnect');
      setStatus({ conectado: false, numero: null });
      setQr(null);
      setConnecting(false);
      setConnectedSince(null);
      addEvent('disconnected', 'Desconectado manualmente');
    } catch (err) {
      setError('Error al desconectar');
      addEvent('error', 'Error al desconectar');
    }
  }

  async function handleRefreshQR() {
    try {
      setConnecting(true);
      addEvent('system', 'Generando nuevo QR...');
      const res = await api.get('/whatsapp/qr');
      if (res.data.qr_data) {
        setQr(res.data.qr_data);
        setConnecting(false);
      } else {
        await handleConnect();
      }
    } catch {
      await handleConnect();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-xl bg-bg2 border border-border hover:border-accent/30 hover:bg-accent/10 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-muted" />
        </button>
        <Smartphone className="w-6 h-6 text-accent" />
        <h1 className="text-2xl font-bold text-text">WhatsApp Bot</h1>
      </div>

      {/* STATUS PRINCIPAL */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-bg2 border rounded-3xl p-6 transition-all duration-500 ${
          status.conectado ? 'border-[#4CAF50]/40 shadow-[0_0_30px_rgba(76,175,80,0.1)]' : 'border-border'
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
              status.conectado ? 'bg-[#4CAF50]/15' : 'bg-bg3'
            }`}>
              {status.conectado ? (
                <Wifi className="w-7 h-7 text-[#4CAF50]" />
              ) : (
                <WifiOff className="w-7 h-7 text-muted" />
              )}
            </div>
            <div>
              <h2 className={`text-xl font-bold transition-colors ${
                status.conectado ? 'text-[#4CAF50]' : 'text-[#FF4D6A]'
              }`}>
                {status.conectado ? 'CONECTADO' : 'DESCONECTADO'}
              </h2>
              {status.numero && (
                <div className="flex items-center gap-1 text-muted text-sm">
                  <Phone className="w-3 h-3" />
                  {status.numero}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`w-4 h-4 rounded-full ${
              status.conectado ? 'bg-[#4CAF50] animate-pulse' : 'bg-[#FF4D6A]'
            }`} />
            {status.conectado && elapsed && (
              <div className="flex items-center gap-1 text-[#4CAF50] text-xs font-mono">
                <Clock size={10} />
                {elapsed}
              </div>
            )}
          </div>
        </div>

        {status.conectado ? (
          <div className="space-y-4">
            <div className="bg-[#4CAF50]/10 border border-[#4CAF50]/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-[#4CAF50]" />
                <span className="text-[#4CAF50] font-medium text-sm">Tu bot está activo y respondiendo</span>
              </div>
              <p className="text-muted text-xs">
                Los clientes te escriben y el bot responde automáticamente con IA.
                {connectedSince && ` Activo desde hace ${elapsed}.`}
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              className="w-full py-3 rounded-2xl border border-[#FF4D6A]/30 text-[#FF4D6A] font-medium text-sm hover:bg-[#FF4D6A]/10 transition-all"
            >
              Desconectar WhatsApp
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="bg-[#FF4D6A]/10 border border-[#FF4D6A]/30 rounded-2xl p-4 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-[#FF4D6A]" />
                <span className="text-[#FF4D6A] text-sm">{error}</span>
              </div>
            )}

            {qr ? (
              <div className="space-y-4">
                <div className="bg-bg3 border border-border rounded-2xl p-6 text-center">
                  <QrCode className="w-8 h-8 text-accent mx-auto mb-3" />
                  <p className="text-text font-medium mb-1">Escanea el código QR</p>
                  <p className="text-muted text-xs mb-4">
                    Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo
                  </p>
                  <div className="bg-white rounded-2xl p-4 inline-block">
                    <img src={`data:image/png;base64,${qr}`} alt="QR Code" className="w-48 h-48" />
                  </div>
                </div>
                <button
                  onClick={handleRefreshQR}
                  className="w-full py-3 rounded-2xl bg-bg3 border border-border text-text font-medium text-sm hover:border-accent/30 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Generar nuevo QR
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full py-4 rounded-2xl bg-accent text-white font-bold text-base hover:bg-accent/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(229,57,53,0.3)]"
              >
                {connecting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Generando código QR...
                  </>
                ) : (
                  <>
                    <Zap size={20} />
                    Conectar WhatsApp
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* LOG DE EVENTOS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-bg2 border border-border rounded-3xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-accent" />
          <h3 className="font-head text-lg font-bold text-text">Actividad reciente</h3>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-muted text-sm text-center py-4">Sin actividad aún</p>
          ) : (
            events.map((ev, i) => (
              <div key={i} className={`flex items-center gap-3 text-sm py-1.5 px-3 rounded-xl ${
                ev.type === 'connected' ? 'bg-[#4CAF50]/5 text-[#4CAF50]' :
                ev.type === 'disconnected' ? 'bg-[#FF4D6A]/5 text-[#FF4D6A]' :
                ev.type === 'error' ? 'bg-[#FF4D6A]/5 text-[#FF4D6A]' :
                ev.type === 'qr' ? 'bg-accent/5 text-accent' :
                'text-muted'
              }`}>
                <span className="font-mono text-xs w-16">{ev.time}</span>
                <span className="flex-1">{ev.message}</span>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* INSTRUCCIONES */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-bg2 border border-border rounded-3xl p-6"
      >
        <h3 className="font-head text-lg font-bold text-text mb-4">Cómo funciona</h3>
        <div className="space-y-3">
          {[
            { step: 1, text: 'Haz clic en "Conectar WhatsApp"' },
            { step: 2, text: 'Escanea el código QR con tu celular' },
            { step: 3, text: '¡Listo! Tu bot ya está activo 24/7' },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <span className="text-accent text-sm font-bold">{item.step}</span>
              </div>
              <p className="text-muted text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="flex items-center gap-3 bg-bg2 border border-border rounded-2xl p-4">
        <Shield className="w-5 h-5 text-accent flex-shrink-0" />
        <p className="text-muted text-xs">
          Tu conexión es segura. No almacenamos tu contraseña de WhatsApp. Puedes desconectar en cualquier momento.
        </p>
      </div>
    </div>
  );
}
