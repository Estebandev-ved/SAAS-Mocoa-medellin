import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandingProvider } from './context/BrandingContext';
import { AuthProvider } from './context/AuthContext';

// Components
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Ticker from './components/Ticker';
import Features from './components/Features';
import Ecosystem from './components/Ecosystem';
import InteractiveDemo from './components/InteractiveDemo';
import ROISimulator from './components/ROISimulator';
import Process from './components/Process';
import Cases from './components/Cases';
import Customizer from './components/Customizer';
import Pricing from './components/Pricing';
import Contact from './components/Contact';
import Footer from './components/Footer';
import { Layers } from 'lucide-react';

const LoadingScreen = () => (
  <motion.div 
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[1000] bg-bg flex items-center justify-center flex-col gap-6"
  >
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
      transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
      className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center shadow-[0_0_50px_rgba(0,255,209,0.4)]"
    >
      <Layers size={40} className="text-bg fill-bg" />
    </motion.div>
    <div className="flex flex-col items-center gap-2">
      <div className="font-mono text-[10px] tracking-[0.4em] text-accent uppercase">Iniciando Motor IA</div>
      <div className="w-48 h-1 bg-border rounded-full overflow-hidden">
        <motion.div 
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-full h-full bg-accent"
        />
      </div>
    </div>
  </motion.div>
);

const HomePage = () => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 2000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <AnimatePresence>
            {loading ? (
                <LoadingScreen key="loader" />
            ) : (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="min-h-screen bg-bg selection:bg-accent selection:text-bg"
                >
                    <Navbar />
                    <main>
                        <Hero />
                        <Ticker />
                        <Features />
                        <Ecosystem />
                        <InteractiveDemo />
                        <ROISimulator />
                        <Cases />
                        <Process />
                        <Customizer />
                        <Pricing />
                        <Contact />
                    </main>
                    <Footer />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BrandingProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </BrandingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
