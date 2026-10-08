import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeft,
  Activity,
  Users,
  MessageSquare,
  ShoppingCart,
  Clock,
  Server,
  Database,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react';

export default function MonitoreoPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [metricsRes, healthRes] = await Promise.all([
        api.get('/metrics').catch(() => ({ data: null })),
        api.get('/../../health').catch(() => ({ data: null }))
      ]);
      setMetrics(metricsRes.data);
      setHealth(healthRes.data);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await api.post('/backup/create');
      alert(`Backup creado: ${res.data.size ? Math.round(res.data.size / 1024) + 'KB' : 'OK'}`);
    } catch {
      alert('Error creando backup');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleExport = (table) => {
    const token = localStorage.getItem('antigravity_token');
    window.open(`${api.defaults.baseURL}/backup/export/${table}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-bg2 border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-muted font-body">{label}</span>
      </div>
      <p className="text-2xl font-head font-bold text-text">{value ?? '-'}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 bg-bg2/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-bg3 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted" />
            </button>
            <div>
              <h1 className="font-head text-xl text-text">Monitoreo</h1>
              <p className="text-xs text-muted">Estado del sistema y métricas en tiempo real</p>
            </div>
          </div>
          <button onClick={fetchData} className="p-2 hover:bg-bg3 rounded-xl transition-colors">
            <RefreshCw className="w-5 h-5 text-muted" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Estado del sistema */}
        <div className="bg-bg2 border border-border rounded-2xl p-6">
          <h2 className="font-head text-lg text-text mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-accent" />
            Estado del Sistema
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              {health?.status === 'ok' ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-danger-text" />
              )}
              <div>
                <p className="text-xs text-muted">API</p>
                <p className="text-sm font-semibold text-text">{health?.status === 'ok' ? 'Operativo' : 'Caído'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted">Uptime</p>
              <p className="text-sm font-semibold text-text">
                {health?.uptime ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Memoria</p>
              <p className="text-sm font-semibold text-text">{health?.memory || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Entorno</p>
              <p className="text-sm font-semibold text-text">{health?.env || '-'}</p>
            </div>
          </div>
        </div>

        {/* Métricas del día */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon={MessageSquare} label="Mensajes Hoy" value={metrics?.mensajes_hoy} color="bg-info/10 text-info-text" />
          <StatCard icon={Activity} label="Conversaciones Activas" value={metrics?.conversaciones_activas} color="bg-success/10 text-success" />
          <StatCard icon={Users} label="Negocios Activos" value={metrics?.negocios_activos} color="bg-purple-500/10 text-purple-400" />
          <StatCard icon={Zap} label="Clientes Nuevos" value={metrics?.clientes_nuevos_hoy} color="bg-warn/10 text-warn-text" />
          <StatCard icon={ShoppingCart} label="Pedidos Hoy" value={metrics?.pedidos_hoy} color="bg-accent/10 text-accent" />
        </div>

        {/* Herramientas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-bg2 border border-border rounded-2xl p-6">
            <h2 className="font-head text-lg text-text mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-accent" />
              Backup y Exportar
            </h2>
            <div className="space-y-3">
              <button
                onClick={handleBackup}
                disabled={backupLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent hover:bg-accent/90 disabled:opacity-50 text-text font-semibold rounded-xl transition-colors"
              >
                {backupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Crear Backup Completo
              </button>
              <div className="grid grid-cols-2 gap-2">
                {['clientes', 'productos', 'pedidos', 'conversaciones'].map(table => (
                  <button
                    key={table}
                    onClick={() => handleExport(table)}
                    className="px-3 py-2 bg-bg3 hover:bg-bg3/80 text-text text-xs font-body rounded-xl border border-border transition-colors"
                  >
                    Exportar {table}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-bg2 border border-border rounded-2xl p-6">
            <h2 className="font-head text-lg text-text mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warn-text" />
              Auditoría Reciente
            </h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {metrics?.auditoria_reciente?.length > 0 ? (
                metrics.auditoria_reciente.map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-body">
                    <span className={`w-2 h-2 rounded-full ${log.status < 400 ? 'bg-success' : 'bg-danger'}`} />
                    <span className="text-muted">{log.method}</span>
                    <span className="text-text truncate flex-1">{log.path}</span>
                    <span className="text-muted">{log.duration}ms</span>
                  </div>
                ))
              ) : (
                <p className="text-muted text-xs">Sin registros recientes</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
