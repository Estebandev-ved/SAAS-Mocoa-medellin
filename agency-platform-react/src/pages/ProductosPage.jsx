import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';
import Toast from '../components/Toast';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useHitos } from '../context/HitosContext';
import TipNova from '../components/TipNova';
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
  Camera,
  Check,
} from 'lucide-react';

export default function ProductosPage() {
  const navigate = useNavigate();
  const { celebrar } = useHitos();
  const [productos, setProductos] = useState([]);
  const [restaurantes, setRestaurantes] = useState([]);
  const [filtroRestaurante, setFiltroRestaurante] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: '', stock: '', categoria: '', imagen_url: '', restaurante_id: '' });
  const [saving, setSaving] = useState(false);
  const [leyendoCarta, setLeyendoCarta] = useState(false);
  const [itemsImportados, setItemsImportados] = useState(null); // null = sin importación en curso
  const [restauranteImportando, setRestauranteImportando] = useState('');
  const [guardandoImport, setGuardandoImport] = useState(false);

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

  const cargarRestaurantes = async () => {
    try {
      const res = await api.get('/restaurantes');
      setRestaurantes(res.data.restaurantes || []);
    } catch {
      // Cuenta de un solo local: sencillamente no hay restaurantes que listar.
    }
  };

  useEffect(() => { cargarProductos(); cargarRestaurantes(); }, []);

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
        categoria: form.categoria.trim() || null,
        imagen_url: form.imagen_url.trim() || null,
        restaurante_id: form.restaurante_id || null,
      };
      if (editando) {
        await api.put(`/productos/${editando.id}`, body);
        setToast({ type: 'success', message: 'Producto actualizado' });
      } else {
        await api.post('/productos', body);
        setToast({ type: 'success', message: 'Producto creado' });
        celebrar('producto');
      }
      setShowForm(false);
      setEditando(null);
      setForm({ nombre: '', descripcion: '', precio: '', stock: '', categoria: '', imagen_url: '', restaurante_id: '' });
      cargarProductos();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (p) => {
    setEditando(p);
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      precio: p.precio,
      stock: p.stock || '',
      categoria: p.categoria || '',
      imagen_url: p.imagen_url || '',
      restaurante_id: p.restaurante_id || '',
    });
    setShowForm(true);
  };

  // Carga rápida de catálogo: una foto de la carta física en vez de escribir cada
  // plato a mano. La IA puede leer mal un precio o un nombre borroso, así que el
  // resultado siempre pasa por esta pantalla de revisión antes de guardarse.
  const handleFotoCarta = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo después
    if (!file) return;

    setLeyendoCarta(true);
    setItemsImportados(null);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.post('/productos/importar-foto', { imagen: base64 });
      const items = (res.data.items || []).map((it, i) => ({ ...it, id: i, incluir: true }));
      setItemsImportados(items);
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || 'No pudimos leer la carta. Intenta con una foto más clara.' });
    } finally {
      setLeyendoCarta(false);
    }
  };

  const actualizarItemImportado = (id, campo, valor) => {
    setItemsImportados((prev) => prev.map((it) => (it.id === id ? { ...it, [campo]: valor } : it)));
  };

  const confirmarImportacion = async () => {
    const seleccionados = itemsImportados.filter((it) => it.incluir && it.nombre.trim() && Number(it.precio) > 0);
    if (seleccionados.length === 0) {
      setToast({ type: 'error', message: 'Selecciona al menos un producto con nombre y precio' });
      return;
    }
    setGuardandoImport(true);
    try {
      const res = await api.post('/productos/bulk', {
        productos: seleccionados.map((it) => ({
          nombre: it.nombre.trim(),
          descripcion: it.descripcion?.trim() || null,
          precio: Number(it.precio),
          categoria: it.categoria?.trim() || null,
        })),
        restaurante_id: restauranteImportando || null,
      });
      setToast({ type: 'success', message: `${res.data.creados} productos agregados de tu carta` });
      celebrar('producto');
      setItemsImportados(null);
      setRestauranteImportando('');
      cargarProductos();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || 'No se pudieron guardar los productos' });
    } finally {
      setGuardandoImport(false);
    }
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

  const hayRestaurantes = restaurantes.length > 0;
  const productosFiltrados = !hayRestaurantes || filtroRestaurante === 'todos'
    ? productos
    : filtroRestaurante === 'sin_restaurante'
      ? productos.filter(p => !p.restaurante_id)
      : productos.filter(p => String(p.restaurante_id) === filtroRestaurante);

  const categorias = [...new Set(productosFiltrados.map(p => p.categoria).filter(Boolean))].sort();
  const hayCategorias = categorias.length > 0;
  const gruposProductos = hayCategorias
    ? [...categorias, null].map(cat => ({ categoria: cat, items: productosFiltrados.filter(p => (p.categoria || null) === cat) })).filter(g => g.items.length > 0)
    : [{ categoria: null, items: productosFiltrados }];

  const nombreRestaurante = (id) => restaurantes.find(r => r.id === id)?.nombre;

  return (
    <div className="min-h-screen bg-bg">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <header className="sticky top-0 z-40 bg-bg2/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/dashboard')} className="tap-44 shrink-0 hover:bg-bg3 rounded-xl transition-colors" aria-label="Volver al dashboard">
              <ArrowLeft className="w-5 h-5 text-muted" />
            </button>
            <div>
              <h1 className="font-head text-xl text-text">Productos y Servicios</h1>
              <p className="text-xs text-muted hidden sm:block">Gestiona lo que vendes. El bot usará esta info para responder.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1 sm:flex-none justify-center min-h-[44px] flex items-center gap-2 px-4 py-2 bg-white hover:bg-bg2 text-text text-sm font-semibold rounded-xl border border-[#C9C9C9] transition-colors cursor-pointer">
              {leyendoCarta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {leyendoCarta ? 'Leyendo tu carta…' : 'Importar carta con foto'}
              <input type="file" accept="image/*" className="hidden" onChange={handleFotoCarta} disabled={leyendoCarta} />
            </label>
            <button
              onClick={() => { setEditando(null); setForm({ nombre: '', descripcion: '', precio: '', stock: '', categoria: '', imagen_url: '' }); setShowForm(true); }}
              className="min-h-[44px] flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-text text-sm font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <TipNova id="productos" className="mb-6">Todo lo que agregues aquí es lo que tu bot ofrece y cotiza por WhatsApp. Usa nombres claros, el precio real y una descripción corta.</TipNova>

        {hayRestaurantes && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-muted">Restaurante:</span>
            <select
              value={filtroRestaurante}
              onChange={(e) => setFiltroRestaurante(e.target.value)}
              className="bg-bg border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent/50"
            >
              <option value="todos">Todos</option>
              {restaurantes.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              <option value="sin_restaurante">Sin restaurante asignado</option>
            </select>
          </div>
        )}

        {itemsImportados && (
          <div className="bg-bg2 border border-border rounded-2xl p-4 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-head text-lg text-text">Revisa lo que encontramos en tu carta</h3>
              <button onClick={() => setItemsImportados(null)} className="tap-44 hover:bg-bg3 rounded-lg" aria-label="Cerrar">
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>
            <p className="text-xs text-muted mb-4">
              Corrige lo que la IA haya leído mal y desmarca lo que no quieras agregar. Nada se guarda hasta que confirmes.
            </p>

            {hayRestaurantes && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-muted">Esta carta es de:</span>
                <select
                  value={restauranteImportando}
                  onChange={(e) => setRestauranteImportando(e.target.value)}
                  className="bg-bg border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent/50"
                >
                  <option value="">Sin asignar a un restaurante</option>
                  {restaurantes.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {itemsImportados.map((it) => (
                <div
                  key={it.id}
                  className={`grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_120px_140px] gap-2 items-center rounded-xl p-2 ${it.incluir ? 'bg-bg' : 'bg-bg opacity-50'}`}
                >
                  <button
                    type="button"
                    onClick={() => actualizarItemImportado(it.id, 'incluir', !it.incluir)}
                    className={`w-11 h-11 sm:w-6 sm:h-6 row-span-3 sm:row-span-1 self-start sm:self-center rounded-md border flex items-center justify-center flex-shrink-0 ${it.incluir ? 'bg-accent border-accent' : 'border-border'}`}
                    aria-label={it.incluir ? 'Quitar de la importación' : 'Incluir en la importación'}
                  >
                    {it.incluir && <Check className="w-4 h-4 text-white" />}
                  </button>
                  <input
                    type="text"
                    value={it.nombre}
                    onChange={(e) => actualizarItemImportado(it.id, 'nombre', e.target.value)}
                    placeholder="Nombre"
                    className="w-full col-start-2 sm:col-auto min-h-[44px] sm:min-h-0 bg-transparent border-b border-border px-1 py-1 text-sm text-text focus:outline-none focus:border-accent"
                  />
                  <input
                    type="number"
                    value={it.precio}
                    onChange={(e) => actualizarItemImportado(it.id, 'precio', e.target.value)}
                    placeholder="Precio"
                    className="w-full col-start-2 sm:col-auto min-h-[44px] sm:min-h-0 bg-transparent border-b border-border px-1 py-1 text-sm text-text focus:outline-none focus:border-accent"
                  />
                  <input
                    type="text"
                    value={it.categoria || ''}
                    onChange={(e) => actualizarItemImportado(it.id, 'categoria', e.target.value)}
                    placeholder="Categoría"
                    className="w-full col-start-2 sm:col-auto min-h-[44px] sm:min-h-0 bg-transparent border-b border-border px-1 py-1 text-sm text-muted focus:outline-none focus:border-accent"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 mt-2 border-t border-border">
              <span className="text-xs text-muted">
                {itemsImportados.filter((it) => it.incluir).length} de {itemsImportados.length} seleccionados
              </span>
              <button
                onClick={confirmarImportacion}
                disabled={guardandoImport}
                className="min-h-[44px] justify-center flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-text text-sm font-semibold rounded-xl transition-colors"
              >
                {guardandoImport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Agregar a mi catálogo
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <div className="bg-bg2 border border-border rounded-2xl p-4 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-head text-lg text-text">{editando ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => { setShowForm(false); setEditando(null); }} className="tap-44 hover:bg-bg3 rounded-lg" aria-label="Cerrar">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1">Categoría</label>
                  <input
                    type="text" list="categorias-sugeridas" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}
                    placeholder="Ej: Platos fuertes"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent/50"
                  />
                  <datalist id="categorias-sugeridas">
                    {categorias.map(c => <option key={c} value={c} />)}
                    <option value="Entradas" />
                    <option value="Platos fuertes" />
                    <option value="Bebidas" />
                    <option value="Postres" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Foto (URL)</label>
                  <input
                    type="url" value={form.imagen_url} onChange={e => setForm({...form, imagen_url: e.target.value})}
                    placeholder="https://..."
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="w-32">
                  <label className="block text-xs text-muted mb-1">Stock</label>
                  <input
                    type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})}
                    placeholder="0"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent/50"
                  />
                </div>
                {hayRestaurantes && (
                  <div>
                    <label className="block text-xs text-muted mb-1">Restaurante</label>
                    <select
                      value={form.restaurante_id}
                      onChange={e => setForm({...form, restaurante_id: e.target.value})}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-accent/50"
                    >
                      <option value="">Sin asignar</option>
                      {restaurantes.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditando(null); }}
                  className="px-4 py-2 text-muted hover:text-text text-sm rounded-xl border border-border transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="min-h-[44px] flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-text text-sm font-semibold rounded-xl transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editando ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <PageLoader />
        ) : productos.length === 0 ? (
          <EmptyState
            character="sofia"
            title="No tienes productos aún"
            description="Agrega productos o servicios para que el bot los conozca."
            className="py-16"
          />
        ) : (
          <div className="space-y-6">
            {gruposProductos.map(grupo => (
              <div key={grupo.categoria || '_sin_categoria'}>
                {hayCategorias && (
                  <h2 className="font-head text-sm text-muted uppercase tracking-wide mb-3">
                    {grupo.categoria || 'Sin categoría'}
                  </h2>
                )}
                <div className="space-y-3">
                  {grupo.items.map(p => (
                    <div key={p.id} className="bg-bg2 border border-border rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3 sm:gap-4">
                      {p.imagen_url && (
                        <img
                          src={p.imagen_url}
                          alt={p.nombre}
                          className="w-16 h-16 rounded-xl object-cover border border-border flex-shrink-0"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <div className="flex-1 min-w-0 break-words">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-head text-text font-semibold">{p.nombre}</h3>
                          {hayRestaurantes && p.restaurante_id && (
                            <span className="text-[11px] px-2 py-0.5 bg-bg3 text-muted rounded-full">{nombreRestaurante(p.restaurante_id)}</span>
                          )}
                        </div>
                        {p.descripcion && <p className="text-sm text-muted mt-1">{p.descripcion}</p>}
                        <p className="text-accent font-head font-bold mt-2">{formatPrice(p.precio)}</p>
                      </div>
                      <div className="flex items-center sm:gap-1 shrink-0">
                        <button onClick={() => handleEdit(p)} className="tap-44 hover:bg-bg3 rounded-lg transition-colors" aria-label="Editar producto">
                          <Edit3 className="w-4 h-4 text-muted" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="tap-44 hover:bg-danger/10 rounded-lg transition-colors" aria-label="Eliminar producto">
                          <Trash2 className="w-4 h-4 text-danger-text" />
                        </button>
                      </div>
                    </div>
                  ))}
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
