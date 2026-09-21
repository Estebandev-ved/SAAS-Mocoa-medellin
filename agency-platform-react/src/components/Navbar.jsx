import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, User } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

// Navegación (design.md): barra superior de 64px en black con texto claro.
const btnPrimary = 'inline-flex items-center justify-center h-11 px-5 rounded-xl bg-accent text-white font-semibold text-sm no-underline cursor-pointer border-none transition-colors hover:bg-accent2';
const btnSecondaryInverse = 'hidden sm:inline-flex items-center justify-center h-11 px-5 rounded-xl bg-transparent text-inverse-text font-semibold text-sm cursor-pointer border border-white/20 transition-colors hover:bg-white/10';

const Navbar = () => {
  const { branding } = useBranding();
  const { isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    { name: 'Ecosistema', href: '/#ecosistema' },
    { name: 'ROI', href: '/#simulador' },
    { name: 'Demo Bot', href: '/#interactive' },
    { name: 'Proceso', href: '/#proceso' },
    { name: 'Precios', href: '/#pricing' },
  ];

  const scrollToContact = () => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] h-16 bg-inverse text-inverse-text border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 no-underline">
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle cx="24" cy="24" r="24" fill="var(--color-primary)" />
            <path d="M24 12L32 20L24 28L16 20L24 12Z" fill="var(--inverse)" />
            <path d="M24 20L32 28L24 36L16 28L24 20Z" fill="var(--inverse)" opacity="0.6" />
          </svg>
          <span className="font-head text-base font-extrabold tracking-[0.08em] text-inverse-text uppercase">
            {branding.name}
          </span>
        </Link>

        {/* Desktop Links */}
        <ul className="hidden md:flex items-center gap-8 list-none m-0 p-0">
          {navLinks.map((link) => (
            <li key={link.name}>
              <a
                href={link.href}
                className="text-[#A0A0A0] hover:text-inverse-text transition-colors text-sm font-medium no-underline"
              >
                {link.name}
              </a>
            </li>
          ))}
        </ul>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <button onClick={() => navigate('/dashboard')} className={btnPrimary}>
              <User size={16} className="mr-2" /> Ir al panel
            </button>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-flex items-center h-11 px-3 text-[#A0A0A0] hover:text-inverse-text text-sm font-semibold no-underline transition-colors">
                Iniciar sesión
              </Link>
              <button onClick={scrollToContact} className={btnSecondaryInverse}>
                Contactar
              </button>
              <Link to="/register" className={`hidden sm:inline-flex ${btnPrimary}`}>
                Crear cuenta
              </Link>
            </>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden text-inverse-text bg-transparent border-none cursor-pointer w-11 h-11 flex items-center justify-center"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="absolute top-full left-0 right-0 bg-inverse border-b border-white/10 p-6 flex flex-col gap-2 md:hidden"
          >
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-inverse-text no-underline font-medium text-lg py-3 border-b border-white/10"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}

            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className={`${btnPrimary} mt-4`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Ir al panel
              </Link>
            ) : (
              <div className="flex flex-col gap-3 mt-4">
                <Link
                  to="/login"
                  className="text-inverse-text no-underline font-semibold text-base py-2 text-center"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Iniciar sesión
                </Link>
                <button
                  className={`${btnSecondaryInverse} !inline-flex w-full`}
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    scrollToContact();
                  }}
                >
                  Contactar
                </button>
                <Link
                  to="/register"
                  className={`${btnPrimary} w-full`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Crear cuenta
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
