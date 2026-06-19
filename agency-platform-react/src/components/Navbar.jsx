import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Menu, X, ArrowRight, User } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const { branding } = useBranding();
  const { isAuthenticated, user } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Ecosistema', href: '/#ecosistema' },
    { name: 'ROI', href: '/#simulador' },
    { name: 'Demo Bot', href: '/#interactive' },
    { name: 'Proceso', href: '/#proceso' },
    { name: 'Precios', href: '/#pricing' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
      isScrolled ? 'h-16 bg-bg/85 backdrop-blur-lg border-b border-border' : 'h-20 bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link 
          to="/" 
          className="flex items-center gap-3 no-underline"
        >
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-[0_0_20px_rgba(0,255,209,0.3)]"
          >
            <Layers size={18} className="text-bg fill-bg" />
          </motion.div>
          <span className="font-mono text-sm font-bold tracking-[0.25em] text-text uppercase">
            {branding.name}
          </span>
        </Link>

        {/* Desktop Links */}
        <ul className="hidden md:flex items-center gap-8 list-none m-0">
          {navLinks.map((link) => (
            <li key={link.name}>
              <a 
                href={link.href}
                className="text-muted hover:text-text transition-colors text-sm font-medium no-underline"
              >
                {link.name}
              </a>
            </li>
          ))}
        </ul>

        {/* Right Actions */}
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-muted">
            <div className="w-2 h-2 rounded-full bg-accent pulse-glow" />
            SISTEMA ACTIVO
          </div>
          
          {isAuthenticated ? (
            <motion.button
                whileHover={{ y: -2, backgroundColor: 'rgba(0,255,209,0.1)' }}
                onClick={() => navigate('/dashboard')}
                className="hidden sm:flex items-center gap-2 bg-transparent border border-accent/30 text-accent px-4 py-2 rounded-lg font-mono text-[11px] font-bold tracking-wider cursor-pointer transition-all duration-300"
            >
                <User size={14} /> DASHBOARD
            </motion.button>
          ) : (
            <div className="hidden sm:flex items-center gap-4">
                <a 
                    href={`${import.meta.env.VITE_ANTIGRAVITY_URL || 'http://localhost:5174'}/login`}
                    className="no-underline"
                >
                    <span className="text-[11px] font-mono font-bold tracking-wider text-muted hover:text-accent transition-colors">LOGIN</span>
                </a>
                <a 
                    href={`${import.meta.env.VITE_ANTIGRAVITY_URL || 'http://localhost:5174'}/register`}
                    className="no-underline"
                >
                    <motion.span
                        whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,255,209,0.3)' }}
                        whileTap={{ scale: 0.98 }}
                        className="bg-accent text-bg px-4 py-2 rounded-lg font-mono text-[11px] font-bold tracking-wider cursor-pointer inline-block"
                    >
                        CREAR CUENTA
                    </motion.span>
                </a>
            </div>
          )}

          <motion.button
            whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,255,209,0.3)' }}
            whileTap={{ scale: 0.98 }}
            className="hidden sm:flex bg-accent text-bg px-5 py-2 rounded-lg font-mono text-[11px] font-bold tracking-wider cursor-pointer border-none items-center gap-2"
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
          >
            CONTACTAR <ArrowRight size={14} />
          </motion.button>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden text-text bg-transparent border-none cursor-pointer p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-bg2 border-b border-border p-6 flex flex-col gap-4 md:hidden"
          >
            {navLinks.map((link) => (
              <a 
                key={link.name}
                href={link.href}
                className="text-text no-underline font-medium text-lg py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
                <div className="h-px w-full bg-border mt-2" />
              </a>
            ))}
            
            {isAuthenticated ? (
                <Link 
                    to="/dashboard" 
                    className="text-accent no-underline font-bold text-lg py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                >
                    IR AL PANEL
                </Link>
            ) : (
                <div className="flex flex-col gap-3">
                    <a 
                        href={`${import.meta.env.VITE_ANTIGRAVITY_URL || 'http://localhost:5174'}/login`}
                        className="text-text no-underline font-medium text-lg py-2"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        INICIAR SESIÓN
                    </a>
                    <a 
                        href={`${import.meta.env.VITE_ANTIGRAVITY_URL || 'http://localhost:5174'}/register`}
                        className="bg-accent text-bg text-center py-3 rounded-xl font-bold font-mono tracking-widest"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        CREAR CUENTA
                    </a>
                </div>
            )}

            <button
              className="bg-accent text-bg py-4 rounded-xl font-bold font-mono tracking-widest mt-2"
              onClick={() => {
                setIsMobileMenuOpen(false);
                document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              CONTACTAR AHORA
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
