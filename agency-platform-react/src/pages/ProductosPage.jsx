import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeft,
  Plus,
  Loader2,
  Package,
  Edit3,
  Trash2,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

function Toast({ type, message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-4">
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl ${
        type === 'success' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
      }`}>
        {type === 'success' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
        <span className="text-sm text-text">{message}</span>
      </div>
    </div>
  );
}

export default function ProductosPage() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: '', stock: '' });
  const [saving, setSaving] = useState(false);

  const cargarProductos = async () => {
    try {
      const res = await api.get('/productos');
      setProductos(res.data.productos || res.data.data || []);
    } catch {
      setToast({ type: 'error', message: 'Error al cargar productos' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarProductos(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.precio) {
      setToast({ type: 'error', message: 'Nombre y precio son requeridos' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        nombre: form.nombre,
        descripcion: form.descripcion,
        precio: parseFloat(form.precio),
        stock: parseInt(form.stock) || 0,
      };
      if (editando) {
        await api.put(`/productos/${editando.id}`, body);
        setToast({ type: 'success', message: 'Producto actualizado' });
      } else {
        await api.post('/productos', body);
        setToast({ type: 'success', message: 'Producto creado' });
      }
      setShowForm(false);
      setEditando(null);
      setForm({ nombre: '', descripcion: '', precio: '', stock: '' });
      cargarProductos();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (p) => {
    setEditando(p);
    setForm({ nombre: p.nombre, descripcion: p.descripcion || '', precio: p.precio, stock: p.stock || '' });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await api.delete(`/productos/${id}`);
      setToast({ type: 'success', message: 'Producto eliminado' });
      cargarProductos();
    } catch {
      setToast({ type: 'error', message: 'Error al eliminar' });
    }
  };

  const formatPrice = (p) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(p);

  return (
    <div className="min-h-screen bg-bg">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <header className="sticky top-0 z-40 bg-bg2/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-bg3 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted" />
            </button>
            <div>
              <h1 className="font-head text-xl text-text">Productos y Servicios</h1>
              <p className="text-xs text-muted">Gestiona lo que vendes. El bot usará esta info para responder.</p>
            </div>
          </div>
          <button
            onClick={() => { setEditando(null); setForm({ nombre: '', descripcion: '', precio: '', stock: '' }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-text text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {showForm && (
          <div className="bg-bg2 border border-border rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-head text-lg text-text">{editando ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => { setShowForm(false); setEditando(null); }} className="p-1 hover:bg-bg3 rounded-lg">
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1">Nombre *</label>
                  <input
                    type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                    placeholder="Ej: Plan Professional"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Precio (COP) *</label>
                  <input
                    type="number" value={form.precio} onChange={e => setForm({...form, precio: e.target.value})}
                    placeholder="Ej: 850000"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Descripción</label>
                <textarea
                  value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})}
                  rows={3} placeholder="Describe qué incluye este producto o servicio..."
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent/50 resize-none"
                />
              </div>
              <div className="w-32">
                <label className="block text-xs text-muted mb-1">Stock</label>
                <input
                  type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})}
                  placeholder="0"
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent/50"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditando(null); }}
                  className="px-4 py-2 text-muted hover:text-text text-sm rounded-xl border border-border transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-text text-sm font-semibold rounded-xl transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editando ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>
        ) : productos.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted text-sm">No tienes productos aún.</p>
            <p className="text-muted text-xs mt-1">Agrega productos o servicios para que el bot los conozca.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {productos.map(p => (
              <div key={p.id} className="bg-bg2 border border-border rounded-2xl p-5 flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-head text-text font-semibold">{p.nombre}</h3>
                  {p.descripcion && <p className="text-sm text-muted mt-1">{p.descripcion}</p>}
                  <p className="text-accent font-head font-bold mt-2">{formatPrice(p.precio)}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={() => handleEdit(p)} className="p-2 hover:bg-bg3 rounded-lg transition-colors">
                    <Edit3 className="w-4 h-4 text-muted" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && productos.length > 0 && (
          <div className="mt-6 bg-bg2 border border-border rounded-2xl p-4">
            <p className="text-xs text-muted">
              El bot usa estos productos para responder a clientes. Cuando alguien pregunte por precios,
              el bot dará esta información exacta.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
