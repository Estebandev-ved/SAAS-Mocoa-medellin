import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { initSocket, subscribeToNegocio, onBotQR, onBotConnected, onBotDisconnected, disconnectSocket } from '../../services/socket';
import './WhatsAppPage.css';

export default function WhatsAppPage() {
  const { negocio } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStatus();
    initSocketConnection();
    
    return () => {
      disconnectSocket();
    };
  }, [negocio?.id]);

  const initSocketConnection = () => {
    const token = localStorage.getItem('ag_token');
    if (!token || !negocio?.id) return;
    
    initSocket(token);
    subscribeToNegocio(negocio.id);
    
    onBotQR((data) => {
      if (data.negocioId === negocio.id && data.qr) {
        setStatus(prev => ({ ...prev, qr: data.qr, conectado: false }));
      }
    });
    
    onBotConnected((data) => {
      if (data.negocioId === negocio.id) {
        setStatus(prev => ({ ...prev, conectado: true, qr: null }));
        fetchStatus();
      }
    });
    
    onBotDisconnected((data) => {
      if (data.negocioId === negocio.id) {
        setStatus(prev => ({ ...prev, conectado: false }));
        fetchStatus();
      }
    });
  };

  const fetchStatus = async () => {
    try {
      const response = await apiService.get('/whatsapp/status');
      setStatus(response);
      setError(null);
    } catch (err) {
      console.error('Error fetching status:', err);
      setError('Error al obtener estado');
      setStatus({ conectado: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await apiService.post('/whatsapp/connect', {});
      const pollInterval = setInterval(async () => {
        await fetchStatus();
        if (status?.conectado) {
          clearInterval(pollInterval);
          setConnecting(false);
        }
      }, 3000);
      
      setTimeout(() => {
        clearInterval(pollInterval);
        setConnecting(false);
      }, 60000);
    } catch (err) {
      setError(err.message || 'Error al conectar');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('¿Estás seguro de desconectar el bot de WhatsApp?')) {
      return;
    }
    
    setDisconnecting(true);
    setError(null);
    try {
      await apiService.post('/whatsapp/disconnect', {});
      await fetchStatus();
    } catch (err) {
      setError(err.message || 'Error al desconectar');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="whatsapp-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando estado...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="whatsapp-page">
      <div className="whatsapp-header">
        <h1>WhatsApp Business</h1>
        <p>Conecta tu número de WhatsApp para recibir pedidos automáticamente</p>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="whatsapp-card">
        <div className="status-section">
          <div className="status-indicator">
            <span className={`status-dot ${status?.conectado ? 'connected' : 'disconnected'}`}></span>
            <span className="status-text">
              {status?.conectado ? 'ACTIVO' : 'DESCONECTADO'}
            </span>
          </div>
          
          {status?.conectado && status?.numero && (
            <p className="phone-number">{status.numero}</p>
          )}
        </div>

        {!status?.conectado && status?.qr && (
          <div className="qr-section">
            <h3>Escanea el código QR</h3>
            <p>Abre WhatsApp en tu teléfono y escanea este código</p>
            <div className="qr-container">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(status.qr)}`} alt="QR Code" />
            </div>
            <p className="qr-hint">El código se actualiza automáticamente</p>
          </div>
        )}

        <div className="actions-section">
          {!status?.conectado ? (
            <button 
              className="btn-connect" 
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <>
                  <span className="spinner-small"></span>
                  Conectando...
                </>
              ) : (
                'Conectar WhatsApp'
              )}
            </button>
          ) : (
            <button 
              className="btn-disconnect" 
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <>
                  <span className="spinner-small"></span>
                  Desconectando...
                </>
              ) : (
                'Desconectar'
              )}
            </button>
          )}
        </div>

        <div className="info-section">
          <h4>Información importante</h4>
          <ul>
            <li>Solo puedes tener un número conectado a la vez</li>
            <li>El número debe tener WhatsApp Business</li>
            <li>Mantén la sesión activa para recibir pedidos 24/7</li>
            <li>No puedes usar el mismo número en otro dispositivo</li>
          </ul>
        </div>

        {!status?.conectado && negocio?.plan === 'starter' && (
          <div className="upgrade-banner">
            <p>¿Quieres más funcionalidades? <a href="/dashboard/plan">Upgrade a Professional</a></p>
          </div>
        )}
      </div>
    </div>
  );
}
