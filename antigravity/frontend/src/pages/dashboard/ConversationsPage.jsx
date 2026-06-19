import { useState, useEffect } from 'react';
import { conversationsService } from '../../services/api';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import './ConversationsPage.css';

export default function ConversationsPage() {
  const [conversaciones, setConversaciones] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [filtro, setFiltro] = useState('todas');

  useEffect(() => {
    fetchConversaciones();
  }, []);

  const fetchConversaciones = async () => {
    try {
      const data = await conversationsService.getAll();
      setConversaciones(data.conversaciones || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!mensaje.trim() || !selectedConv) return;
    try {
      await conversationsService.sendMessage(selectedConv.id, mensaje);
      setMensaje('');
      fetchConversaciones();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const filteredConversaciones = conversaciones.filter(c => {
    if (filtro === 'todas') return true;
    if (filtro === 'con_pedido') return c.pedido_id;
    if (filtro === 'sin_pedido') return !c.pedido_id;
    return true;
  });

  return (
    <div className="conversations-page">
      <div className="conversations-list">
        <div className="list-header">
          <h3>Conversaciones</h3>
          <div className="filter-tabs">
            {['todas', 'con_pedido', 'sin_pedido'].map(f => (
              <button key={f} className={filtro === f ? 'active' : ''} onClick={() => setFiltro(f)}>
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        <div className="conversations-scroll">
          {loading ? (
            [...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: '72px', margin: '8px' }}></div>)
          ) : filteredConversaciones.length === 0 ? (
            <div className="empty-list">
              <p>No hay conversaciones</p>
            </div>
          ) : (
            filteredConversaciones.map(conv => (
              <div
                key={conv.id}
                className={`conversation-item ${selectedConv?.id === conv.id ? 'selected' : ''}`}
                onClick={() => setSelectedConv(conv)}
              >
                <div className="conv-avatar">{conv.cliente?.nombre?.charAt(0) || 'C'}</div>
                <div className="conv-content">
                  <div className="conv-header">
                    <span className="conv-name">{conv.cliente?.nombre || 'Cliente'}</span>
                    <span className="conv-time">2 min</span>
                  </div>
                  <p className="conv-preview">{conv.ultimo_mensaje || 'Sin mensajes'}</p>
                  {conv.pedido_id && <StatusBadge estado="activo" size="sm" />}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="chat-panel">
        {selectedConv ? (
          <>
            <div className="chat-header">
              <div className="chat-user">
                <div className="conv-avatar">{selectedConv.cliente?.nombre?.charAt(0) || 'C'}</div>
                <div>
                  <span className="chat-name">{selectedConv.cliente?.nombre}</span>
                  <span className="chat-whatsapp">{selectedConv.cliente?.whatsapp}</span>
                </div>
              </div>
              <StatusBadge estado={selectedConv.pedido_id ? 'activo' : 'inactivo'} />
            </div>
            <div className="chat-messages">
              {selectedConv.mensajes?.map((msg, i) => (
                <div key={i} className={`message ${msg.rol}`}>
                  <div className="message-bubble">{msg.contenido}</div>
                  <span className="message-time">{new Date(msg.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
            <div className="chat-input">
              <input
                type="text"
                placeholder="Escribir mensaje..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <Button onClick={handleSendMessage}>Enviar</Button>
            </div>
          </>
        ) : (
          <div className="no-chat">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>Selecciona una conversación</p>
          </div>
        )}
      </div>
    </div>
  );
}
