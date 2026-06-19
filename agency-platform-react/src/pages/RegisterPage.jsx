import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, Mail, Phone, ArrowRight, Loader2, AlertCircle, Layers } from 'lucide-react';

const RegisterPage = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const result = await register(name, email, password, phone);
        
        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error);
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent2/10 blur-[120px] rounded-full"></div>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md glass p-8 rounded-3xl relative z-10 border border-border"
            >
                <div className="text-center mb-10">
                    <Link to="/" className="inline-block">
                        <motion.div 
                            whileHover={{ scale: 1.1 }}
                            className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-accent/20 cursor-pointer"
                        >
                            <Layers className="text-accent" size={32} />
                        </motion.div>
                    </Link>
                    <h1 className="font-head text-3xl font-bold mb-2">Crear Cuenta</h1>
                    <p className="text-muted text-sm">Únete al ecosistema de automatización</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-500 text-sm"
                        >
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </motion.div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-mono uppercase tracking-wider text-muted px-1">Nombre completo</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <input 
                                type="text" 
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-bg2/50 border border-border rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-accent transition-all duration-300"
                                placeholder="Tu nombre"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-mono uppercase tracking-wider text-muted px-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-bg2/50 border border-border rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-accent transition-all duration-300"
                                placeholder="tu@email.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-mono uppercase tracking-wider text-muted px-1">Teléfono (WhatsApp)</label>
                        <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <input 
                                type="tel" 
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full bg-bg2/50 border border-border rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-accent transition-all duration-300"
                                placeholder="+57 300 123 4567"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-mono uppercase tracking-wider text-muted px-1">Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-bg2/50 border border-border rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-accent transition-all duration-300"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-accent text-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-white transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                Crear Cuenta 
                                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-muted text-xs">
                        ¿Ya tienes cuenta?{' '}
                        <Link to="/login" className="text-accent hover:underline">
                            Iniciar Sesión
                        </Link>
                    </p>
                </div>
                
                <div className="mt-4 text-center">
                    <Link to="/" className="text-muted text-xs hover:text-accent transition-colors">
                        ← Volver a la página principal
                    </Link>
                </div>
            </motion.div>
        </div>
    );
};

export default RegisterPage;
