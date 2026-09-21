import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, Mail, Phone, ArrowRight, ArrowLeft, Loader2, Check, Store, UtensilsCrossed, Briefcase, HeartPulse, Home, GraduationCap, Package } from 'lucide-react';
import AvatarEditor from '../components/avatar/AvatarEditor';
import { DEFAULT_AVATAR } from '../components/avatar/avatarConfig';
import FeedbackMessage from '../components/FeedbackMessage';
import { businessService } from '../services/api';

const inputCls =
    'w-full h-11 bg-white border border-[#C9C9C9] rounded-xl pl-12 pr-4 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors';
const labelCls = 'block text-sm font-semibold text-text mb-2';

const Field = ({ label, icon: Icon, ...props }) => (
    <div>
        <label className={labelCls}>{label}</label>
        <div className="relative">
            <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input {...props} className={inputCls} />
        </div>
    </div>
);

const STEPS = ['Tus datos', 'Tu negocio', 'Tu personaje'];

// El tipo de negocio precarga el mensaje de bienvenida y un catálogo demo (POST /business/plantilla)
const TIPOS = [
    { id: 'restaurante', label: 'Restaurante', icon: UtensilsCrossed },
    { id: 'retail', label: 'Tienda', icon: Store },
    { id: 'servicios', label: 'Servicios', icon: Briefcase },
    { id: 'salud', label: 'Salud', icon: HeartPulse },
    { id: 'inmobiliaria', label: 'Inmobiliaria', icon: Home },
    { id: 'educacion', label: 'Educación', icon: GraduationCap },
    { id: 'otro', label: 'Otro', icon: Package },
];

const RegisterPage = () => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [terminos, setTerminos] = useState(false);
    const [negocio, setNegocio] = useState('');
    const [tipo, setTipo] = useState('');
    const [avatar, setAvatar] = useState({ ...DEFAULT_AVATAR });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const { register, updateUser } = useAuth();
    const navigate = useNavigate();

    const handleNext = (e) => {
        e.preventDefault();
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        if (!terminos) {
            setError('Debes aceptar los términos y el tratamiento de datos para continuar');
            return;
        }
        setError('');
        setStep(2);
    };

    const handleNegocio = (e) => {
        e.preventDefault();
        if (!tipo) {
            setError('Elige el tipo de negocio');
            return;
        }
        setError('');
        setStep(3);
    };

    const handleCreate = async () => {
        setIsLoading(true);
        setError('');

        const result = await register(name, email, password, phone, avatar, terminos);

        if (result.success) {
            // Datos del negocio y plantilla: no bloquean la entrada al panel si fallan
            try {
                await businessService.saveOnboardingStep(2, { nombre_comercial: negocio, tipo_negocio: tipo });
                updateUser({ nombre: negocio });
                await businessService.aplicarPlantilla(tipo);
            } catch (e) {
                console.error('Onboarding parcial:', e);
            }
            navigate('/dashboard');
        } else {
            setError(result.error || 'No pudimos crear la cuenta');
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-bg2 flex flex-col items-center px-6 py-10">
            <Link to="/" className="flex items-center gap-3 no-underline mb-8">
                <svg width="36" height="36" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                    <circle cx="24" cy="24" r="24" fill="#E53935" />
                    <path d="M24 12L32 20L24 28L16 20L24 12Z" fill="#FFFFFF" />
                    <path d="M24 20L32 28L24 36L16 28L24 20Z" fill="#FFFFFF" opacity="0.6" />
                </svg>
                <span className="font-head text-lg font-extrabold tracking-[0.08em] text-text">ANTIGRAVITY</span>
            </Link>

            {/* Progreso */}
            <ol className="flex items-center gap-3 mb-8 list-none p-0">
                {STEPS.map((label, i) => {
                    const n = i + 1;
                    const done = step > n;
                    const active = step === n;
                    return (
                        <li key={label} className="flex items-center gap-3">
                            <span
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                    done || active ? 'bg-accent text-white' : 'bg-[#E4E4E4] text-muted'
                                }`}
                            >
                                {done ? <Check size={16} /> : n}
                            </span>
                            <span className={`text-sm font-semibold ${active ? 'text-text' : 'text-muted'}`}>{label}</span>
                            {i < STEPS.length - 1 && <span className="w-10 h-px bg-[#C9C9C9]" />}
                        </li>
                    );
                })}
            </ol>

            <motion.div
                layout
                className={`w-full bg-white border border-border rounded-3xl p-8 ${step === 3 ? 'max-w-4xl' : step === 2 ? 'max-w-2xl' : 'max-w-md'}`}
            >
                {error && <FeedbackMessage type="error" className="mb-6">{error}</FeedbackMessage>}

                <AnimatePresence mode="wait">
                    {step === 1 ? (
                        <motion.form
                            key="datos"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            onSubmit={handleNext}
                            className="space-y-5"
                        >
                            <div className="mb-2">
                                <h1 className="font-head text-3xl font-bold mb-2">Crea tu cuenta</h1>
                                <p className="text-muted text-sm">Únete al ecosistema de automatización</p>
                            </div>

                            <Field label="Nombre completo" icon={User} type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
                            <Field label="Email" icon={Mail} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
                            <Field label="Teléfono (WhatsApp)" icon={Phone} type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+57 300 123 4567" />
                            <Field label="Contraseña" icon={Lock} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />

                            <label className="flex items-start gap-3 text-sm text-muted cursor-pointer leading-5">
                                <input
                                    type="checkbox"
                                    checked={terminos}
                                    onChange={(e) => setTerminos(e.target.checked)}
                                    className="mt-1 w-4 h-4 accent-[#C62828] shrink-0"
                                />
                                <span>
                                    Acepto los términos y condiciones y autorizo el tratamiento de mis datos personales según la Ley 1581 de 2012.
                                </span>
                            </label>

                            <button
                                type="submit"
                                className="w-full h-12 bg-accent hover:bg-accent2 text-white font-semibold rounded-xl flex items-center justify-center gap-2 border-none cursor-pointer transition-colors"
                            >
                                Continuar <ArrowRight size={18} />
                            </button>
                        </motion.form>
                    ) : step === 2 ? (
                        <motion.form
                            key="negocio"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            onSubmit={handleNegocio}
                            className="space-y-6"
                        >
                            <div>
                                <h1 className="font-head text-3xl font-bold mb-2">Cuéntanos de tu negocio</h1>
                                <p className="text-muted text-sm">Con esto dejamos tu bot listo con un mensaje de bienvenida y un catálogo de ejemplo. El resto lo completas después, dentro del panel.</p>
                            </div>

                            <Field label="Nombre de tu negocio" icon={Store} type="text" required value={negocio} onChange={(e) => setNegocio(e.target.value)} placeholder="Mi Tienda" />

                            <div>
                                <label className={labelCls}>Tipo de negocio</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {TIPOS.map((t) => {
                                        const Icon = t.icon;
                                        const active = tipo === t.id;
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setTipo(t.id)}
                                                aria-pressed={active}
                                                className={`flex flex-col items-center gap-2 py-4 rounded-2xl border text-sm font-semibold cursor-pointer transition-colors ${
                                                    active ? 'border-accent bg-[#FDECEA] text-accent' : 'border-border bg-white text-text hover:border-[#C9C9C9]'
                                                }`}
                                            >
                                                <Icon size={22} />
                                                {t.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setError(''); setStep(1); }}
                                    className="h-12 px-5 rounded-xl bg-transparent text-accent font-semibold inline-flex items-center gap-2 border-none cursor-pointer hover:bg-accent-dim transition-colors"
                                >
                                    <ArrowLeft size={18} /> Atrás
                                </button>
                                <button
                                    type="submit"
                                    className="h-12 px-8 bg-accent hover:bg-accent2 text-white font-semibold rounded-xl inline-flex items-center gap-2 border-none cursor-pointer transition-colors"
                                >
                                    Continuar <ArrowRight size={18} />
                                </button>
                            </div>
                        </motion.form>
                    ) : (
                        <motion.div
                            key="avatar"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                        >
                            <div className="mb-8">
                                <h1 className="font-head text-3xl font-bold mb-2">Crea a tu personaje</h1>
                                <p className="text-muted text-sm max-w-xl">
                                    Será tu cara en el panel: te saludará cada día. Haz que se parezca a ti; podrás cambiarlo cuando quieras en Ajustes.
                                </p>
                            </div>

                            <AvatarEditor value={avatar} onChange={setAvatar} />

                            <div className="flex items-center justify-between mt-10">
                                <button
                                    type="button"
                                    onClick={() => { setError(''); setStep(2); }}
                                    className="h-12 px-5 rounded-xl bg-transparent text-accent font-semibold inline-flex items-center gap-2 border-none cursor-pointer hover:bg-accent-dim transition-colors"
                                >
                                    <ArrowLeft size={18} /> Atrás
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCreate}
                                    disabled={isLoading}
                                    className="h-12 px-8 bg-accent hover:bg-accent2 text-white font-semibold rounded-xl inline-flex items-center gap-2 border-none cursor-pointer transition-colors disabled:bg-[#F0F0F0] disabled:text-muted disabled:cursor-not-allowed"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : <>Crear cuenta <ArrowRight size={18} /></>}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            <p className="text-muted text-sm mt-6">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-accent font-semibold hover:underline">Iniciar sesión</Link>
            </p>
            <Link to="/" className="text-muted text-xs mt-3 hover:text-accent transition-colors no-underline">
                ← Volver a la página principal
            </Link>
        </div>
    );
};

export default RegisterPage;
