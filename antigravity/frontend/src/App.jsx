import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));

const DashboardLayout = lazy(() => import('./pages/dashboard/DashboardLayout'));
const OverviewPage = lazy(() => import('./pages/dashboard/OverviewPage'));
const OrdersPage = lazy(() => import('./pages/dashboard/OrdersPage'));
const ConversationsPage = lazy(() => import('./pages/dashboard/ConversationsPage'));
const ProductsPage = lazy(() => import('./pages/dashboard/ProductsPage'));
const AnalyticsPage = lazy(() => import('./pages/dashboard/AnalyticsPage'));
const AutomationsPage = lazy(() => import('./pages/dashboard/AutomationsPage'));
const CustomizePage = lazy(() => import('./pages/dashboard/CustomizePage'));
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
const WhatsAppPage = lazy(() => import('./pages/dashboard/WhatsAppPage'));

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminResumen = lazy(() => import('./pages/admin/AdminResumen'));
const AdminNegocios = lazy(() => import('./pages/admin/AdminNegocios'));
const AdminNegocioDetalle = lazy(() => import('./pages/admin/AdminNegocio'));
const AdminWhatsApps = lazy(() => import('./pages/admin/AdminWhatsApps'));
const AdminSuscripciones = lazy(() => import('./pages/admin/AdminSuscripciones'));
const AdminLogs = lazy(() => import('./pages/admin/AdminLogs'));
const AdminConfig = lazy(() => import('./pages/admin/AdminConfig'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AdminLoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#080C10',
      color: '#00FFD1',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '13px',
      letterSpacing: '0.1em'
    }}>
      CARGANDO PANEL ADMIN...
    </div>
  );
}

function DashboardLoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#0A0F14',
      color: '#8892A0'
    }}>
      <div className="loading-spinner"></div>
    </div>
  );
}

function LandingPage() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0A0F14', 
      color: '#E8F0F7',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      textAlign: 'center'
    }}>
      <div style={{ marginBottom: '24px' }}>
        <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="24" fill="#00FFD1" />
          <path d="M24 12L32 20L24 28L16 20L24 12Z" fill="#0A0F14" />
        </svg>
      </div>
      <h1 style={{ fontSize: '48px', fontWeight: '800', marginBottom: '16px', letterSpacing: '2px' }}>
        ANTIGRAVITY
      </h1>
      <p style={{ fontSize: '20px', color: '#8892A0', marginBottom: '48px', maxWidth: '600px' }}>
        Automatizacion inteligente por WhatsApp. Vende mas, trabaja menos.
      </p>
      <div style={{ display: 'flex', gap: '16px' }}>
        <a 
          href="/login"
          style={{ 
            padding: '16px 32px', 
            border: '1px solid #00FFD1', 
            borderRadius: '12px',
            color: '#00FFD1',
            textDecoration: 'none',
            fontWeight: '600'
          }}
        >
          Iniciar Sesion
        </a>
        <a 
          href="/register"
          style={{ 
            padding: '16px 32px', 
            background: '#00FFD1', 
            borderRadius: '12px',
            color: '#0A0F14',
            textDecoration: 'none',
            fontWeight: '600'
          }}
        >
          Crear Cuenta
        </a>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0A0F14', 
      color: '#E8F0F7',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '72px', fontWeight: '800', marginBottom: '16px', color: '#00FFD1' }}>
        404
      </h1>
      <p style={{ fontSize: '20px', color: '#8892A0', marginBottom: '32px' }}>
        Pagina no encontrada
      </p>
      <a 
        href="/"
        style={{ 
          padding: '12px 24px', 
          border: '1px solid #00FFD1', 
          borderRadius: '8px',
          color: '#00FFD1',
          textDecoration: 'none'
        }}
      >
        Volver al inicio
      </a>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Suspense fallback={<DashboardLoadingScreen />}><LoginPage /></Suspense>} />
            <Route path="/register" element={<Suspense fallback={<DashboardLoadingScreen />}><RegisterPage /></Suspense>} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Suspense fallback={<DashboardLoadingScreen />}>
                  <DashboardLayout />
                </Suspense>
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/dashboard/resumen" replace />} />
              <Route path="resumen" element={<Suspense fallback={<DashboardLoadingScreen />}><OverviewPage /></Suspense>} />
              <Route path="whatsapp" element={<Suspense fallback={<DashboardLoadingScreen />}><WhatsAppPage /></Suspense>} />
              <Route path="pedidos" element={<Suspense fallback={<DashboardLoadingScreen />}><OrdersPage /></Suspense>} />
              <Route path="conversaciones" element={<Suspense fallback={<DashboardLoadingScreen />}><ConversationsPage /></Suspense>} />
              <Route path="productos" element={<Suspense fallback={<DashboardLoadingScreen />}><ProductsPage /></Suspense>} />
              <Route path="analytics" element={<Suspense fallback={<DashboardLoadingScreen />}><AnalyticsPage /></Suspense>} />
              <Route path="automatizaciones" element={<Suspense fallback={<DashboardLoadingScreen />}><AutomationsPage /></Suspense>} />
              <Route path="personalizar" element={<Suspense fallback={<DashboardLoadingScreen />}><CustomizePage /></Suspense>} />
              <Route path="ajustes" element={<Suspense fallback={<DashboardLoadingScreen />}><SettingsPage /></Suspense>} />
            </Route>
            
            <Route path="/admin" element={
              <AdminRoute>
                <Suspense fallback={<AdminLoadingScreen />}>
                  <AdminLayout />
                </Suspense>
              </AdminRoute>
            }>
              <Route index element={<Navigate to="/admin/resumen" replace />} />
              <Route path="resumen" element={<Suspense fallback={<AdminLoadingScreen />}><AdminResumen /></Suspense>} />
              <Route path="negocios" element={<Suspense fallback={<AdminLoadingScreen />}><AdminNegocios /></Suspense>} />
              <Route path="negocios/:id" element={<Suspense fallback={<AdminLoadingScreen />}><AdminNegocioDetalle /></Suspense>} />
              <Route path="whatsapps" element={<Suspense fallback={<AdminLoadingScreen />}><AdminWhatsApps /></Suspense>} />
              <Route path="suscripciones" element={<Suspense fallback={<AdminLoadingScreen />}><AdminSuscripciones /></Suspense>} />
              <Route path="logs" element={<Suspense fallback={<AdminLoadingScreen />}><AdminLogs /></Suspense>} />
              <Route path="config" element={<Suspense fallback={<AdminLoadingScreen />}><AdminConfig /></Suspense>} />
            </Route>
            
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: { background: '#0A0F14', color: '#E8F0F7', border: '1px solid #00FFD1' },
              success: { iconTheme: { primary: '#00FFD1', secondary: '#0A0F14' } },
              error: { iconTheme: { primary: '#FF5252', secondary: '#0A0F14' } }
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
