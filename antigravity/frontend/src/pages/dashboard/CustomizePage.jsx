import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import './CustomizePage.css';

export default function CustomizePage() {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('marca');
  const [config, setConfig] = useState({
    nombre_negocio: user?.nombre || '',
    color_principal: user?.color_principal || '#00FFD1',
    nombre_bot: 'Asistente',
    tono_voz: 'amigable',
    mensaje_bienvenida: '¡Hola! Soy el asistente de {negocio}. ¿En qué puedo ayudarte?',
    metodos_pago: { nequi: true, bancolombia: true, efectivo: true }
  });

  const handleSave = () => {
    updateUser(config);
    alert('Configuración guardada');
  };

  return (
    <div className="customize-page">
      <div className="page-header">
        <h2>Personalizar</h2>
        <Button onClick={handleSave}>Guardar cambios</Button>
      </div>

      <div className="customize-tabs">
        {['marca', 'bot', 'pagos', 'notificaciones'].map(tab => (
          <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="customize-content">
        {activeTab === 'marca' && (
          <div className="customize-section">
            <h3>Marca</h3>
            <Input label="Nombre del negocio" value={config.nombre_negocio} onChange={(e) => setConfig({ ...config, nombre_negocio: e.target.value })} />
            <div className="color-picker">
              <label>Color principal</label>
              <input type="color" value={config.color_principal} onChange={(e) => setConfig({ ...config, color_principal: e.target.value })} />
              <span>{config.color_principal}</span>
            </div>
            <div className="logo-upload">
              <label>Logo</label>
              <div className="upload-area">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Arrastra o selecciona</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bot' && (
          <div className="customize-section">
            <h3>Configuración del Bot</h3>
            <Input label="Nombre del bot" value={config.nombre_bot} onChange={(e) => setConfig({ ...config, nombre_bot: e.target.value })} />
            <div className="form-group">
              <label>Tono de voz</label>
              <select value={config.tono_voz} onChange={(e) => setConfig({ ...config, tono_voz: e.target.value })}>
                <option value="formal">Formal</option>
                <option value="amigable">Amigable</option>
                <option value="casual">Casual</option>
              </select>
            </div>
            <div className="form-group">
              <label>Mensaje de bienvenida</label>
              <textarea value={config.mensaje_bienvenida} onChange={(e) => setConfig({ ...config, mensaje_bienvenida: e.target.value })} rows={4} />
            </div>
          </div>
        )}

        {activeTab === 'pagos' && (
          <div className="customize-section">
            <h3>Métodos de pago</h3>
            {Object.entries(config.metodos_pago).map(([key, value]) => (
              <label key={key} className="checkbox-wrapper">
                <input type="checkbox" checked={value} onChange={() => setConfig({ ...config, metodos_pago: { ...config.metodos_pago, [key]: !value } })} />
                <span className="checkbox-custom"></span>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
