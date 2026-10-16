import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle, CheckCircle2, Layers } from 'lucide-react';
import { authService } from '../services/api';

const inputClase = 'w-full bg-white border border-border rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-accent transition-all duration-300';

const Marco = ({ titulo, subtitulo, children }) => (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 relative overflow-hidden">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md glass p-8 rounded-3xl relative z-10 border border-border">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-accent/20">
                    <Layers className="text-accent" size={32} />
                </div>
                <h1 className="font-head text-3xl font-bold mb-2">{titulo}</h1>
                <p className="text-muted text-sm">{subtitulo}</p>
            </div>
            {children}
            <div className="mt-6 text-center">
                <Link to="/login" className="text-muted text-xs hover:text-accent transition-colors">← Volver a iniciar sesión</Link>
            </div>
        </motion.div>
    </div>
);

const Aviso = ({ tipo, children }) => (
    <div className={`${tipo === 'ok' ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-danger/10 border-danger/20 text-danger-text'} border p-4 rounded-xl flex items-center gap-3 text-sm`}>
        {tipo === 'ok' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
        <span>{children}</span>
    </div>
);

// Mismas reglas que el servidor (api/services/passwordPolicy.js); el servidor es quien decide.
const errorPassword = (p) => {
    if (p.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Debe combinar letras y números';
    return '';
};

export const OlvidePasswordPage = () => {
    const [email, setEmail] = useState('');
    const [cargando, setCargando] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const [error, setError] = useState('');

    const enviar = async (e) => {
        e.preventDefault();
        setCargando(true); setError('');
        try {
            const r = await authService.forgotPassword(email);
            setMensaje(r.mensaje);
        } catch (err) {
            setError(err.response?.data?.error || 'No pudimos procesar la solicitud. Intenta de nuevo.');
        }
        setCargando(false);
    };

    return (
        <Marco titulo="Recuperar contraseña" subtitulo="Te enviaremos un enlace a tu correo">
            {mensaje ? <Aviso tipo="ok">{mensaje}</Aviso> : (
                <form onSubmit={enviar} className="space-y-6">
                    {error && <Aviso tipo="error">{error}</Aviso>}
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                            className={inputClase} placeholder="tu@email.com" />
                    </div>
                    <button type="submit" disabled={cargando}
                        className="w-full bg-accent text-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white transition-all disabled:opacity-50">
                        {cargando ? <Loader2 className="animate-spin" size={20} /> : 'Enviar enlace'}
                    </button>
                </form>
            )}
        </Marco>
    );
};

export const RestablecerPasswordPage = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get('token') || '';
    const email = params.get('email') || '';
    const [password, setPassword] = useState('');
    const [confirmar, setConfirmar] = useState('');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [listo, setListo] = useState(false);

    const enviar = async (e) => {
        e.preventDefault();
        setError('');
        const problema = errorPassword(password);
        if (problema) return setError(problema);
        if (password !== confirmar) return setError('Las contraseñas no coinciden');
        setCargando(true);
        try {
            await authService.resetPassword(email, token, password);
            setListo(true);
            setTimeout(() => navigate('/login'), 2500);
        } catch (err) {
            setError(err.response?.data?.error || 'No pudimos cambiar la contraseña. Intenta de nuevo.');
        }
        setCargando(false);
    };

    if (!token || !email) {
        return <Marco titulo="Enlace inválido" subtitulo="Solicita un enlace nuevo para continuar">
            <Link to="/olvide-password" className="block text-center text-accent hover:underline text-sm">Pedir enlace nuevo</Link>
        </Marco>;
    }

    return (
        <Marco titulo="Nueva contraseña" subtitulo="Mínimo 8 caracteres, con letras y números">
            {listo ? <Aviso tipo="ok">Contraseña actualizada. Te llevamos al inicio de sesión…</Aviso> : (
                <form onSubmit={enviar} className="space-y-6">
                    {error && <Aviso tipo="error">{error}</Aviso>}
                    {[['Nueva contraseña', password, setPassword], ['Repite la contraseña', confirmar, setConfirmar]].map(([etiqueta, valor, set]) => (
                        <div className="relative" key={etiqueta}>
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <input type="password" required autoComplete="new-password" value={valor}
                                onChange={(e) => set(e.target.value)} className={inputClase} placeholder={etiqueta} />
                        </div>
                    ))}
                    <button type="submit" disabled={cargando}
                        className="w-full bg-accent text-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white transition-all disabled:opacity-50">
                        {cargando ? <Loader2 className="animate-spin" size={20} /> : 'Cambiar contraseña'}
                    </button>
                </form>
            )}
        </Marco>
    );
};
