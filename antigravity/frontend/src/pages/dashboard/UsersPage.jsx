import { useState, useEffect } from 'react';
import { usuariosService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import './UsersPage.css';

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Solo lectura' }
];

const FORM_INICIAL = { nombre: '', email: '', password: '', rol: 'viewer' };

export default function UsersPage() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState(FORM_INICIAL);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const data = await usuariosService.getAll();
      setUsuarios(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error('Error fetching usuarios:', err);
      setError('No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const openNuevo = () => {
    setEditingUser(null);
    setFormData(FORM_INICIAL);
    setFormError(null);
    setShowModal(true);
  };

  const openEditar = (usuario) => {
    setEditingUser(usuario);
    setFormData({ nombre: usuario.nombre, email: usuario.email, password: '', rol: usuario.rol });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!formData.nombre || !formData.email || (!editingUser && !formData.password)) {
      setFormError('Nombre, email y contraseña son requeridos');
      return;
    }
    setSaving(true);
    try {
      if (editingUser) {
        const cambios = { nombre: formData.nombre, email: formData.email, rol: formData.rol };
        if (formData.password) cambios.password = formData.password;
        await usuariosService.update(editingUser.id, cambios);
      } else {
        await usuariosService.create(formData);
      }
      setShowModal(false);
      fetchUsuarios();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Error al guardar el usuario');
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (usuario) => {
    try {
      await usuariosService.update(usuario.id, { activo: !usuario.activo });
      fetchUsuarios();
    } catch (err) {
      console.error('Error actualizando usuario:', err);
    }
  };

  const handleDelete = async (usuario) => {
    if (!confirm(`¿Eliminar a ${usuario.nombre}? Esta acción no se puede deshacer.`)) return;
    try {
      await usuariosService.delete(usuario.id);
      fetchUsuarios();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar el usuario');
    }
  };

  const limites = { starter: 1, professional: 5, enterprise: 999 };
  const limite = limites[user?.plan] || 1;
  const alLimite = usuarios.length + 1 >= limite;

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h2>Usuarios</h2>
          <p className="page-subtitle">Tu cuenta cuenta como el usuario dueño. Tu plan {user?.plan || 'starter'} permite hasta {limite === 999 ? 'usuarios ilimitados' : `${limite} usuario(s) adicional(es)`}.</p>
        </div>
        <Button onClick={openNuevo} disabled={alLimite}>+ Invitar usuario</Button>
      </div>

      {alLimite && (
        <div className="users-limit-banner">
          Llegaste al límite de usuarios de tu plan. Sube de plan en Ajustes para invitar a más personas.
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="users-table-wrapper">
        {loading ? (
          <div className="skeleton" style={{ height: 200 }}></div>
        ) : usuarios.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            </svg>
            <p>Todavía es solo tu cuenta</p>
            <span>Invita a alguien de tu equipo para que también pueda operar el negocio.</span>
            <Button onClick={openNuevo}>Invitar usuario</Button>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(usuario => (
                <tr key={usuario.id}>
                  <td>{usuario.nombre}</td>
                  <td>{usuario.email}</td>
                  <td>{ROLES.find(r => r.value === usuario.rol)?.label || usuario.rol}</td>
                  <td>
                    <button className="status-toggle" onClick={() => toggleActivo(usuario)}>
                      <StatusBadge estado={usuario.activo ? 'activo' : 'inactivo'} size="sm" />
                    </button>
                  </td>
                  <td>{usuario.ultimo_login ? new Date(usuario.ultimo_login).toLocaleDateString('es-CO') : '—'}</td>
                  <td className="users-actions">
                    <Button size="sm" variant="ghost" onClick={() => openEditar(usuario)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(usuario)}>Eliminar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingUser ? 'Editar usuario' : 'Invitar usuario'}>
        <div className="user-form">
          {formError && <div className="error-banner">{formError}</div>}
          <Input
            label="Nombre"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            placeholder="Nombre completo"
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="correo@ejemplo.com"
          />
          <Input
            label={editingUser ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder={editingUser ? 'Dejar en blanco para no cambiarla' : 'Mínimo 8 caracteres'}
          />
          <div>
            <label className="input-label">Rol</label>
            <select
              className="input-select"
              value={formData.rol}
              onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : (editingUser ? 'Guardar' : 'Invitar')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
