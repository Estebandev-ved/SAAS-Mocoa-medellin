import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';
import Toast from '../components/Toast';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import TipNova from '../components/TipNova';
import {
  ArrowLeft,
  Plus,
  Loader2,
  UtensilsCrossed,
  Edit3,
  Trash2,
  Save,
  X,
  MapPin,
} from 'lucide-react';

export default function RestaurantesPage() {
  const navigate = useNavigate();
  const [restaurantes, setRestaurantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', categoria: '', direccion: '', ciudad: '' });
  const [saving, setSaving] = useState(false);

  const cargarRestaurantes = async () => {
    try {
      const res = await api.get('/restaurantes');
      setRestaurantes(res.data.restaurantes || []);
    } catch {
      setToast({ type: 'error', message: 'Error al cargar restaurantes' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarRestaurantes(); }, []);

  const resetForm = () => setForm({ nombre: '', descripcion: '', categoria: '', direccion: '', ciudad: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      setToast({ type: 'error', message: 'El nombre es requerido' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        categoria: form.categoria.trim() || null,
        direccion: form.direccion.trim() || null,
        ciudad: form.ciudad.trim() || null,
      };
      if (editando) {
        await api.put(`/restaurantes/${editando.id}`, body);
        setToast({ type: 'success', message: 'Restaurante actualizado' });
      } else {
        await api.post('/restaurantes', body);
        setToast({ type: 'success', message: 'Restaurante creado' });
      }
      setShowForm(false);
      setEditando(null);
      resetForm();
      cargarRestaurantes();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r) => {
    setEditando(r);
    setForm({
      nombre: r.nombre,
      descripcion: r.descripcion || '',
      categoria: r.categoria || '',
      direccion: r.direccion || '',
      ciudad: r.ciudad || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este restaurante? Sus productos quedarán sin restaurante asignado.')) return;
    try {
      await api.delete(`/restaurantes/${id}`);
      setToast({ type: 'success', message: 'Restaurante eliminado' });
      cargarRestaurantes();
    } catch {
      setToast({ type: 'error', message: 'Error al eliminar' });
    }
  };

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
              <h1 className="font-head text-xl text-text">Restaurantes</h1>
              <p className="text-xs text-muted">Los locales que atiendes desde tu WhatsApp, cada uno con su propia carta y dirección.</p>
            </div>
          </div>
          <button
            onClick={() => { setEditando(null); resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-text text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Agregar restaurante
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <TipNova id="restaurantes" className="mb-6">
          Agrega aquí cada restaurante que manejas. En Productos podrás asignarle su propia carta, y tu bot le
          preguntará al cliente cuál restaurante quiere antes de mostrarle el menú. Cada domicilio se recoge en
          la dirección de ese restaurante, no en la tuya.
        </TipNova>

        {showForm && (
          <div className="bg-bg2 border border-border rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-head text-lg text-text">{editando ? 'Editar Restaurante' : 'Nuevo Restaurante'}</h3>
              <button onClick={() => { setShowForm(false); setEditando(null); }} className="p-1 hover:bg-bg3 rounded-lg">
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1">Nombre *</label>
                  <input
                    type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej: Sabor Costeño"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Categoría</label>
                  <input
                    type="text" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                    placeholder="Ej: Comida rápida, Mariscos..."
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1">Dirección (punto de recogida)</label>
                  <input
                    type="text" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })}
                    placeholder="Ej: Calle 45 #12-30"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Ciudad</label>
                  <input
                    type="text" value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })}
                    placeholder="Ej: Barranquilla"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Descripción</label>
                <textarea
                  value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  rows={2} placeholder="Una línea corta que el bot puede mostrar junto al nombre..."
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent/50 resize-none"
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
          <PageLoader />
        ) : restaurantes.length === 0 ? (
          <EmptyState
            character="sofia"
            title="Aún no tienes restaurantes"
            description="Si manejas varios locales con cartas distintas, agrégalos aquí para que tu bot le pregunte al cliente cuál quiere."
            className="py-16"
          />
        ) : (
          <div className="space-y-3">
            {restaurantes.map(r => (
              <div key={r.id} className="bg-bg2 border border-border rounded-2xl p-5 flex items-start justify-between gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-head text-text font-semibold">{r.nombre}</h3>
                    {r.categoria && (
                      <span className="text-[11px] px-2 py-0.5 bg-bg3 text-muted rounded-full">{r.categoria}</span>
                    )}
                  </div>
                  {r.descripcion && <p className="text-sm text-muted mt-1">{r.descripcion}</p>}
                  {r.direccion && (
                    <p className="text-xs text-muted mt-2 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {r.direccion}{r.ciudad ? `, ${r.ciudad}` : ''}
                    </p>
                  )}
                  <p className="text-xs text-muted mt-1">{r.total_productos || 0} producto{r.total_productos === 1 ? '' : 's'} en su carta</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={() => handleEdit(r)} className="p-2 hover:bg-bg3 rounded-lg transition-colors">
                    <Edit3 className="w-4 h-4 text-muted" />
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="p-2 hover:bg-danger/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4 text-danger-text" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && restaurantes.length > 0 && (
          <div className="mt-6 bg-bg2 border border-border rounded-2xl p-4">
            <p className="text-xs text-muted">
              Ve a Productos para asignarle su carta a cada restaurante. El bot pedirá al cliente que elija
              un restaurante antes de recomendar productos.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
