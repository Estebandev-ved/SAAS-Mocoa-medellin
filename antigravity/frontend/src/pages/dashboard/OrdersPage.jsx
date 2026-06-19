import { useState, useEffect } from 'react';
import { ordersService } from '../../services/api';
import { onNuevoPedido } from '../../services/socket';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import './OrdersPage.css';

const ESTADOS = ['pendiente_pago', 'pago_enviado', 'pago_confirmado', 'en_preparacion', 'enviado', 'entregado', 'cancelado'];

export default function OrdersPage() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    busqueda: '',
    estado: '',
    fecha_inicio: '',
    fecha_fin: ''
  });
  const [selectedOrder, setSelectedOrder] = useState(null);

  const formatCOP = (val) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  };

  useEffect(() => {
    fetchPedidos();
    
    const unsubscribe = onNuevoPedido((pedido) => {
      console.log('[OrdersPage] Nuevo pedido recibido via socket:', pedido);
      setPedidos(prev => {
        const exists = prev.find(p => p.id === pedido.pedido_id);
        if (!exists) {
          return [{
            id: pedido.pedido_id,
            numero_pedido: pedido.numero_pedido,
            total: pedido.total,
            estado: 'pendiente_pago',
            cliente: { whatsapp: pedido.cliente_whatsapp || '+XXX' },
            created_at: new Date().toISOString(),
            _isNew: true
          }, ...prev];
        }
        return prev;
      });
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const fetchPedidos = async () => {
    try {
      const data = await ordersService.getAll(filtros);
      setPedidos(data.pedidos || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportar = () => {
    console.log('Exportando pedidos...');
  };

  return (
    <div className="orders-page">
      <div className="page-header">
        <h2>Pedidos</h2>
        <Button onClick={handleExportar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exportar CSV
        </Button>
      </div>

      <div className="filters-bar">
        <Input
          placeholder="Buscar por cliente o número de pedido..."
          value={filtros.busqueda}
          onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
          leftIcon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>}
        />
        <select
          className="filter-select"
          value={filtros.estado}
          onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => (
            <option key={e} value={e}>{e.replace('_', ' ')}</option>
          ))}
        </select>
        <input
          type="date"
          className="filter-date"
          value={filtros.fecha_inicio}
          onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })}
        />
        <input
          type="date"
          className="filter-date"
          value={filtros.fecha_fin}
          onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })}
        />
        <Button variant="ghost" onClick={() => setFiltros({ busqueda: '', estado: '', fecha_inicio: '', fecha_fin: '' })}>
          Limpiar
        </Button>
      </div>

      <div className="orders-table-container">
        <table className="orders-table full">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>WhatsApp</th>
              <th>Productos</th>
              <th>Total</th>
              <th>Método</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={9}><div className="skeleton skeleton-row"></div></td>
                </tr>
              ))
            ) : pedidos.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-state">
                  <div className="empty-content">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                    <p>Aún no tienes pedidos</p>
                    <span>Cuando tu bot reciba el primero, aparecerá aquí.</span>
                  </div>
                </td>
              </tr>
            ) : (
              pedidos.map(pedido => (
                <tr key={pedido.id} onClick={() => setSelectedOrder(pedido)}>
                  <td className="order-id">{pedido.numero_pedido}</td>
                  <td>{pedido.cliente?.nombre || 'Cliente'}</td>
                  <td className="whatsapp-cell">{pedido.cliente?.whatsapp || '-'}</td>
                  <td>{pedido.items?.length || 0} items</td>
                  <td className="order-total">{formatCOP(pedido.total)}</td>
                  <td className="metodo-pago">{pedido.metodo_pago || '-'}</td>
                  <td><StatusBadge estado={pedido.estado} /></td>
                  <td className="order-date">{new Date(pedido.created_at).toLocaleDateString('es-CO')}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedOrder(pedido); }}>
                      Ver
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Pedido ${selectedOrder?.numero_pedido}`} size="lg">
        {selectedOrder && (
          <div className="order-detail">
            <div className="detail-section">
              <h4>Cliente</h4>
              <p>{selectedOrder.cliente?.nombre}</p>
              <p className="muted">{selectedOrder.cliente?.whatsapp}</p>
            </div>
            <div className="detail-section">
              <h4>Estado</h4>
              <StatusBadge estado={selectedOrder.estado} />
            </div>
            <div className="detail-section">
              <h4>Total</h4>
              <p className="total-value">{formatCOP(selectedOrder.total)}</p>
            </div>
            <div className="detail-items">
              <h4>Productos</h4>
              {selectedOrder.items?.map((item, i) => (
                <div key={i} className="item-row">
                  <span>{item.producto?.nombre}</span>
                  <span>x{item.cantidad}</span>
                  <span>{formatCOP(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
