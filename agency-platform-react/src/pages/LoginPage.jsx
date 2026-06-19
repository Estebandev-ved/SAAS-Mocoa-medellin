import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Loader2, AlertCircle, Layers } from 'lucide-react';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const result = await login(email, password);
        
        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error);
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background elements */}
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
                    <h1 className="font-head text-3xl font-bold mb-2">Bienvenido</h1>
                    <p className="text-muted text-sm">Ingresa a tu ecosistema de automatización</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
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
                        <label className="text-xs font-mono uppercase tracking-wider text-muted px-1">Email del Dueño</label>
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
                                Iniciar Sesión 
                                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-muted text-xs">
                        ¿No tienes cuenta?{' '}
                        <a href={`${import.meta.env.VITE_ANTIGRAVITY_URL || 'http://localhost:5174'}/register`} className="text-accent hover:underline">
                            Crear Cuenta
                        </a>
                    </p>
                </div>

                <div className="mt-4 text-center">
                    <a href={import.meta.env.VITE_ANTIGRAVITY_URL || 'http://localhost:5174'} className="text-muted text-xs hover:text-accent transition-colors">
                        ← Volver a la página principal
                    </a>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginPage;
