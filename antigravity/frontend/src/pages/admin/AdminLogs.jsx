import { useState, useEffect, useRef } from 'react';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';
import './AdminLogs.css';

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    nivel: '',
    negocio: '',
    tipo: '',
    fechaDesde: '',
    fechaHasta: ''
  });
  const [negocios, setNegocios] = useState([]);
  const [expandedLog, setExpandedLog] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef(null);

  useEffect(() => {
    loadNegocios();
    loadLogs();
  }, [filtros.nivel, filtros.negocio, filtros.tipo]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const loadNegocios = async () => {
    try {
      const data = await apiService.get('/api/admin/negocios?limit=100');
      setNegocios(data.negocios || []);
    } catch (error) {
      console.error('Error loading negocios:', error);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtros.nivel) params.append('nivel', filtros.nivel);
      if (filtros.negocio) params.append('negocio_id', filtros.negocio);
      if (filtros.tipo) params.append('tipo', filtros.tipo);
      if (filtros.fechaDesde) params.append('desde', filtros.fechaDesde);
      if (filtros.fechaHasta) params.append('hasta', filtros.fechaHasta);
      
      const data = await apiService.get(`/api/admin/logs?${params}`);
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Error al cargar logs');
    } finally {
      setLoading(false);
    }
  };

  const exportarLogs = () => {
    const csv = [
      ['Timestamp', 'Nivel', 'Negocio', 'Tipo', 'Mensaje'],
      ...logs.map(l => [
        l.timestamp,
        l.nivel,
        l.nombre_negocio || 'Sistema',
        l.tipo,
        l.mensaje?.replace(/,/g, ';')
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('es-CO', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getNivelClass = (nivel) => {
    const niveles = {
      error: 'error',
      warning: 'warning',
      info: 'info',
      debug: 'debug'
    };
    return niveles[nivel?.toLowerCase()] || 'info';
  };

  const limpiarFiltros = () => {
    setFiltros({
      nivel: '',
      negocio: '',
      tipo: '',
      fechaDesde: '',
      fechaHasta: ''
    });
  };

  const tieneFiltros = Object.values(filtros).some(v => v);

  return (
    <div className="admin-logs">
      <div className="admin-header">
        <h1>Logs</h1>
        <p>Registro de eventos del sistema</p>
      </div>

      <div className="logs-controls">
        <div className="filtros-row">
          <select 
            value={filtros.nivel} 
            onChange={(e) => setFiltros(prev => ({ ...prev, nivel: e.target.value }))}
          >
            <option value="">Todos los niveles</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>

          <select 
            value={filtros.negocio} 
            onChange={(e) => setFiltros(prev => ({ ...prev, negocio: e.target.value }))}
          >
            <option value="">Todos los negocios</option>
            {negocios.map(n => (
              <option key={n.id} value={n.id}>{n.nombre}</option>
            ))}
          </select>

          <select 
            value={filtros.tipo} 
            onChange={(e) => setFiltros(prev => ({ ...prev, tipo: e.target.value }))}
          >
            <option value="">Todos los tipos</option>
            <option value="bot">Bot</option>
            <option value="api">API</option>
            <option value="auth">Auth</option>
            <option value="sistema">Sistema</option>
          </select>

          <input 
            type="date" 
            value={filtros.fechaDesde}
            onChange={(e) => setFiltros(prev => ({ ...prev, fechaDesde: e.target.value }))}
            placeholder="Desde"
          />

          <input 
            type="date" 
            value={filtros.fechaHasta}
            onChange={(e) => setFiltros(prev => ({ ...prev, fechaHasta: e.target.value }))}
            placeholder="Hasta"
          />

          {tieneFiltros && (
            <button className="btn-ghost" onClick={limpiarFiltros}>
              Limpiar
            </button>
          )}
        </div>

        <div className="logs-actions">
          <label className="auto-scroll-toggle">
            <input 
              type="checkbox" 
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
          <button className="btn-secondary" onClick={exportarLogs}>
            Exportar logs
          </button>
          <button className="btn-secondary" onClick={loadLogs}>
            Actualizar
          </button>
        </div>
      </div>

      <div className="logs-table-container">
        <table className="logs-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Nivel</th>
              <th>Negocio</th>
              <th>Tipo</th>
              <th>Mensaje</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="loading-cell">
                  <div className="loading-spinner"></div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-row">No se encontraron logs</td>
              </tr>
            ) : (
              logs.map((log, index) => (
                <tr 
                  key={log.id || index} 
                  className={`log-row ${getNivelClass(log.nivel)}`}
                  onClick={() => setExpandedLog(expandedLog === index ? null : index)}
                >
                  <td className="timestamp-cell">{formatTimestamp(log.timestamp)}</td>
                  <td>
                    <span className={`nivel-badge ${getNivelClass(log.nivel)}`}>
                      {log.nivel?.toUpperCase()}
                    </span>
                  </td>
                  <td className="negocio-cell">{log.nombre_negocio || 'Sistema'}</td>
                  <td>
                    <span className="tipo-badge">{log.tipo}</span>
                  </td>
                  <td className="mensaje-cell">
                    <span className="mensaje-preview">{log.mensaje}</span>
                    {expandedLog === index && log.detalles && (
                      <div className="log-detalles">
                        <pre>{JSON.stringify(log.detalles, null, 2)}</pre>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
