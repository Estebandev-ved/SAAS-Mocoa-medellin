import { useState, useEffect } from 'react';
import { productsService } from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import './ProductsPage.css';

export default function ProductsPage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    stock: '',
    activo: true
  });

  const formatCOP = (val) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  };

  useEffect(() => {
    fetchProductos();
  }, []);

  const fetchProductos = async () => {
    try {
      const data = await productsService.getAll();
      setProductos(data.productos || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingProduct) {
        await productsService.update(editingProduct.id, formData);
      } else {
        await productsService.create(formData);
      }
      setShowModal(false);
      setEditingProduct(null);
      fetchProductos();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      nombre: product.nombre,
      descripcion: product.descripcion || '',
      precio: product.precio,
      stock: product.stock,
      activo: product.activo
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      await productsService.delete(id);
      fetchProductos();
    }
  };

  const getStockColor = (stock) => {
    if (stock > 10) return 'success';
    if (stock > 0) return 'warning';
    return 'error';
  };

  return (
    <div className="products-page">
      <div className="page-header">
        <h2>Productos</h2>
        <Button onClick={() => { setEditingProduct(null); setFormData({ nombre: '', descripcion: '', precio: '', stock: '', activo: true }); setShowModal(true); }}>
          + Nuevo Producto
        </Button>
      </div>

      <div className="products-grid">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="product-card skeleton-card">
              <div className="skeleton" style={{ height: '160px' }}></div>
              <div className="skeleton" style={{ height: '24px', marginTop: '12px' }}></div>
              <div className="skeleton" style={{ height: '20px', width: '60%' }}></div>
            </div>
          ))
        ) : productos.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            <p>Sin productos aún</p>
            <span>Agrega tus productos para que el bot pueda venderlos automáticamente.</span>
            <Button onClick={() => setShowModal(true)}>Agregar Producto</Button>
          </div>
        ) : (
          productos.map(producto => (
            <div key={producto.id} className="product-card">
              <div className="product-image">
                {producto.imagen_url ? (
                  <img src={producto.imagen_url} alt={producto.nombre} />
                ) : (
                  <div className="product-placeholder">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
                <StatusBadge estado={producto.activo ? 'activo' : 'inactivo'} size="sm" />
              </div>
              <div className="product-info">
                <h3>{producto.nombre}</h3>
                <p className="product-price">{formatCOP(producto.precio)}</p>
                <div className={`stock-badge stock-${getStockColor(producto.stock)}`}>
                  Stock: {producto.stock}
                </div>
                <div className="product-actions">
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(producto)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(producto.id)}>Eliminar</Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}>
        <div className="product-form">
          <Input
            label="Nombre"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            placeholder="Nombre del producto"
          />
          <Input
            label="Descripción"
            value={formData.descripcion}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            placeholder="Descripción del producto"
          />
          <Input
            label="Precio"
            type="number"
            value={formData.precio}
            onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
            placeholder="0"
          />
          <Input
            label="Stock"
            type="number"
            value={formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
            placeholder="0"
          />
          <label className="checkbox-wrapper">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
            />
            <span className="checkbox-custom"></span>
            Producto activo
          </label>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingProduct ? 'Guardar' : 'Crear'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
