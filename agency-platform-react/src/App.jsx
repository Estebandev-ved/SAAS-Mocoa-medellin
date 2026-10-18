import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import AppShell from './components/shell/AppShell';
import { BrandingProvider } from './context/BrandingContext';
import { AuthProvider } from './context/AuthContext';
import { HitosProvider } from './context/HitosContext';
import { PedidosLiveProvider } from './context/PedidosLiveContext';
import { UndoProvider } from './context/UndoContext';
import { ConfirmProvider } from './context/ConfirmContext';

// Components
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Ticker from './components/Ticker';
import Features from './components/Features';
import Ecosystem from './components/Ecosystem';
import InteractiveDemo from './components/InteractiveDemo';
import ROISimulator from './components/ROISimulator';
import Process from './components/Process';
import VideoDemo from './components/VideoDemo';
import Personajes from './components/Personajes';
import Pricing from './components/Pricing';
import Contact from './components/Contact';
import Footer from './components/Footer';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { OlvidePasswordPage, RestablecerPasswordPage } from './pages/RecuperarPasswordPage';
import InfoPage from './pages/InfoPage';
import Dashboard from './pages/Dashboard';
import ConversacionesPage from './pages/ConversacionesPage';
import PedidosPage from './pages/PedidosPage';
import ClientesPage from './pages/ClientesPage';
import AutomatizacionesPage from './pages/AutomatizacionesPage';
import GuiaPage from './pages/GuiaPage';
import CuponesPage from './pages/CuponesPage';
import CampanasPage from './pages/CampanasPage';
import FlujosPage from './pages/FlujosPage';
import SuscripcionPage from './pages/SuscripcionPage';
import AjustesPage from './pages/AjustesPage';
import DomiciliosPage from './pages/DomiciliosPage';
import WhatsAppConnectionPage from './pages/WhatsAppConnectionPage';
import BienvenidaPage from './pages/BienvenidaPage';
import ProductosPage from './pages/ProductosPage';
import RestaurantesPage from './pages/RestaurantesPage';
import MonitoreoPage from './pages/MonitoreoPage';
import AnalyticsPage from './pages/AnalyticsPage';
import MultiChannelPage from './pages/MultiChannelPage';
import VoiceBotPage from './pages/VoiceBotPage';
import CajaPage from './pages/CajaPage';
import CocinaPage from './pages/CocinaPage';
import ErrorBoundary from './components/ErrorBoundary';
import FloatingActions from './components/FloatingActions';
import LegalPage from './pages/LegalPage';
import CookieBanner from './components/CookieBanner';
import OfflineBanner from './components/OfflineBanner';

// Panel de administración y portal del domiciliario (carga diferida: no pesan en la web principal)
const L = (loader) => lazy(loader);
const LegacyScope = L(() => import('./legacy/LegacyScope'));
const AdminGuard = L(() => import('./legacy/AdminGuard'));
const AdminLayout = L(() => import('./legacy/pages/admin/AdminLayout'));
const AdminResumen = L(() => import('./legacy/pages/admin/AdminResumen'));
const AdminInteligencia = L(() => import('./legacy/pages/admin/AdminInteligencia'));
const AdminNegocios = L(() => import('./legacy/pages/admin/AdminNegocios'));
const AdminNegocioDetalle = L(() => import('./legacy/pages/admin/AdminNegocio'));
const AdminWhatsApps = L(() => import('./legacy/pages/admin/AdminWhatsApps'));
const AdminSuscripciones = L(() => import('./legacy/pages/admin/AdminSuscripciones'));
const AdminLogs = L(() => import('./legacy/pages/admin/AdminLogs'));
const AdminProspectos = L(() => import('./legacy/pages/admin/AdminProspectos'));
const AdminConfig = L(() => import('./legacy/pages/admin/AdminConfig'));
const PortalDomiciliario = L(() => import('./legacy/pages/dashboard/PortalDomiciliario'));
const TrackingCliente = L(() => import('./legacy/pages/dashboard/TrackingCliente'));
const TerminosDomiciliarioPage = L(() => import('./legacy/pages/dashboard/TerminosDomiciliarioPage'));

const Cargando = () => (
  <div className="min-h-screen bg-bg flex items-center justify-center text-muted text-sm">Cargando…</div>
);
const Lazy = ({ children }) => (
  <Suspense fallback={<Cargando />}><LegacyScope>{children}</LegacyScope></Suspense>
);

const HomePage = () => (
  <div className="min-h-screen bg-bg selection:bg-accent selection:text-bg">
    <Navbar />
    <main>
      <Hero />
      <Ticker />
      <Features />
      <Ecosystem />
      <InteractiveDemo />
      <VideoDemo />
      <ROISimulator />
      <Process />
      <Personajes />
      <Pricing />
      <Contact />
    </main>
    <Footer />
    <FloatingActions />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <BrandingProvider>
            <HitosProvider>
            <PedidosLiveProvider>
            <UndoProvider>
            <ConfirmProvider>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/olvide-password" element={<OlvidePasswordPage />} />
              <Route path="/reset-password" element={<RestablecerPasswordPage />} />
              <Route path="/info" element={<InfoPage />} />
              <Route path="/admin" element={<Lazy><AdminGuard><AdminLayout /></AdminGuard></Lazy>}>
                <Route index element={<Navigate to="/admin/resumen" replace />} />
                <Route path="resumen" element={<AdminResumen />} />
                <Route path="inteligencia" element={<AdminInteligencia />} />
                <Route path="negocios" element={<AdminNegocios />} />
                <Route path="negocios/:id" element={<AdminNegocioDetalle />} />
                <Route path="whatsapps" element={<AdminWhatsApps />} />
                <Route path="suscripciones" element={<AdminSuscripciones />} />
                <Route path="prospectos" element={<AdminProspectos />} />
                <Route path="logs" element={<AdminLogs />} />
                <Route path="config" element={<AdminConfig />} />
              </Route>
              <Route path="/delivery/login" element={<Lazy><PortalDomiciliario /></Lazy>} />
              <Route path="/delivery/portal" element={<Lazy><PortalDomiciliario /></Lazy>} />
              <Route path="/delivery/terminos" element={<Lazy><TerminosDomiciliarioPage /></Lazy>} />
              <Route path="/delivery/track/:token" element={<Lazy><TrackingCliente /></Lazy>} />
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/bienvenida" element={<BienvenidaPage />} />
                <Route path="/conversaciones" element={<ConversacionesPage />} />
                <Route path="/pedidos" element={<PedidosPage />} />
                <Route path="/clientes" element={<ClientesPage />} />
                <Route path="/automatizaciones" element={<AutomatizacionesPage />} />
                <Route path="/guia" element={<GuiaPage />} />
                <Route path="/cupones" element={<CuponesPage />} />
                <Route path="/campanas" element={<CampanasPage />} />
                <Route path="/flujos" element={<FlujosPage />} />
                <Route path="/suscripcion" element={<SuscripcionPage />} />
                <Route path="/caja" element={<CajaPage />} />
                <Route path="/cocina" element={<CocinaPage />} />
                <Route path="/domicilios" element={<DomiciliosPage />} />
                <Route path="/productos" element={<ProductosPage />} />
                <Route path="/restaurantes" element={<RestaurantesPage />} />
                <Route path="/monitoreo" element={<MonitoreoPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/multichannel" element={<MultiChannelPage />} />
                <Route path="/voice" element={<VoiceBotPage />} />
                <Route path="/whatsapp" element={<WhatsAppConnectionPage />} />
                <Route path="/ajustes" element={<AjustesPage />} />
              </Route>
              <Route path="/terminos" element={<LegalPage />} />
              <Route path="/privacidad" element={<LegalPage />} />
              <Route path="/cookies" element={<LegalPage />} />
            </Routes>
            <OfflineBanner />
            <CookieBanner />
            </ConfirmProvider>
            </UndoProvider>
            </PedidosLiveProvider>
            </HitosProvider>
          </BrandingProvider>
        </AuthProvider>
      </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
