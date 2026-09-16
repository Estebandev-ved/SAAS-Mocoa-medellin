import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  CheckCircle,
  Users,
  Plus,
  MapPin,
  Clock,
  Phone,
  User,
  Loader2,
  RefreshCw,
  X,
  Lock,
  Zap,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import api from '../services/api';
import { usePlan } from '../components/PlanGate';

export default function DomiciliosPage() {
  const { hasFeature } = usePlan();
  const navigate = useNavigate();
  const [apiPlan, setApiPlan] = useState(null);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const res = await api.get('/business/plan');
        if (res.data?.plan?.tipo) {
          setApiPlan(res.data.plan.tipo);
        }
      } catch (e) {}
    };
    fetchPlan();
  }, []);

  const effectivePlan = apiPlan || 'starter';
  const domiciliosAllowed = effectivePlan !== 'starter';

  const [activeTab, setActiveTab] = useState('pendientes');
  const [domicilios, setDomicilios] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driverStats, setDriverStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [driverForm, setDriverForm] = useState({ nombre: '', telefono: '', pin: '' });
  const [assignLoading, setAssignLoading] = useState(false);
  const [selectedDomicilioId, setSelectedDomicilioId] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [domiciliosRes, driversRes] = await Promise.all([
        api.get('/domicilios/active'),
        api.get('/domicilios/drivers'),
      ]);
      setDomicilios(domiciliosRes.data?.domicilios || []);
      setDrivers(driversRes.data?.drivers || []);
      setDriverStats(driversRes.data?.stats || null);
    } catch (error) {
      console.error('Error fetching domicilios data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (domiciliosAllowed) {
      fetchData();
    }
  }, [domiciliosAllowed]);

  const handleAssign = async (domicilioId, driverId) => {
    try {
      setAssignLoading(true);
      await api.post('/domicilios/assign', { domicilioId, driverId });
      setShowAssignModal(false);
      setSelectedDomicilioId(null);
      fetchData();
    } catch (error) {
      console.error('Error assigning domicilio:', error);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAddDriver = async (e) => {
    e.preventDefault();
    try {
      setAssignLoading(true);
      await api.post('/domicilios/drivers', driverForm);
      setShowDriverForm(false);
      setDriverForm({ nombre: '', telefono: '', pin: '' });
      fetchData();
    } catch (error) {
      console.error('Error adding driver:', error);
    } finally {
      setAssignLoading(false);
    }
  };

  const pendientes = domicilios.filter((d) => d.estado === 'pendiente');
  const enRuta = domicilios.filter((d) => d.estado === 'en_ruta');
  const completados = domicilios.filter((d) => d.estado === 'completado');

  const tabs = [
    { id: 'pendientes', label: 'Pendientes', count: pendientes.length },
    { id: 'en_ruta', label: 'En Ruta', count: enRuta.length },
    { id: 'completados', label: 'Completados', count: completados.length },
    { id: 'domiciliarios', label: 'Domiciliarios', count: drivers.length },
  ];

  if (!domiciliosAllowed) {
    return (
      <div className="min-h-screen bg-bg p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-bg2 border border-border rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-bg3 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-muted" />
            </div>
            <h2 className="text-2xl font-bold text-text mb-3">
              Gestión de Domicilios
            </h2>
            <p className="text-muted mb-8">
              Gestiona domicilios, asigna domiciliarios y rastrea entregas en tiempo real.
            </p>

            <div className="bg-bg3 rounded-lg p-6 mb-8 text-left">
              <h3 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" />
                Incluido en Professional
              </h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-text">
                  <Truck className="w-5 h-5 text-accent" />
                  Gestión ilimitada de domicilios
                </li>
                <li className="flex items-center gap-3 text-text">
                  <Users className="w-5 h-5 text-accent" />
                  Múltiples domiciliarios
                </li>
                <li className="flex items-center gap-3 text-text">
                  <MapPin className="w-5 h-5 text-accent" />
                  Seguimiento en tiempo real
                </li>
                <li className="flex items-center gap-3 text-text">
                  <Clock className="w-5 h-5 text-accent" />
                  Historial de entregas
                </li>
              </ul>
            </div>

            <button
              onClick={() => navigate('/suscripcion')}
              className="inline-flex items-center gap-2 bg-accent text-bg px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Mejorar a Professional
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-xl bg-bg2 border border-border hover:border-accent/30 hover:bg-accent/10 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-muted" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-text">Domicilios</h1>
              <p className="text-muted">Gestiona domicilios y domiciliarios</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 bg-bg2 border border-border rounded-lg px-4 py-2 text-text hover:bg-bg3 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-accent text-bg'
                  : 'bg-bg2 text-muted hover:text-text'
              }`}
            >
              {tab.label}
              <span className="bg-bg3 text-text text-xs px-2 py-0.5 rounded-full">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'pendientes' && (
              <motion.div
                key="pendientes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-bg2 border border-border rounded-xl overflow-hidden"
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-4 text-muted font-medium">Cliente</th>
                        <th className="text-left p-4 text-muted font-medium">Dirección</th>
                        <th className="text-left p-4 text-muted font-medium">Pedido</th>
                        <th className="text-left p-4 text-muted font-medium">Valor</th>
                        <th className="text-left p-4 text-muted font-medium">Hora</th>
                        <th className="text-left p-4 text-muted font-medium">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendientes.map((domicilio) => (
                        <tr key={domicilio.id} className="border-b border-border last:border-0 hover:bg-bg3 transition-colors">
                          <td className="p-4 text-text">{domicilio.cliente}</td>
                          <td className="p-4 text-text">{domicilio.direccion}</td>
                          <td className="p-4 text-text">{domicilio.pedido}</td>
                          <td className="p-4 text-accent font-semibold">${domicilio.valor?.toLocaleString()}</td>
                          <td className="p-4 text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {domicilio.hora}
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => {
                                setSelectedDomicilioId(domicilio.id);
                                setShowAssignModal(true);
                              }}
                              className="flex items-center gap-1 bg-accent text-bg px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                            >
                              <Truck className="w-3 h-3" />
                              Asignar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {pendientes.length === 0 && (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-muted">
                            No hay domicilios pendientes
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'en_ruta' && (
              <motion.div
                key="en_ruta"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-bg2 border border-border rounded-xl overflow-hidden"
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-4 text-muted font-medium">Cliente</th>
                        <th className="text-left p-4 text-muted font-medium">Dirección</th>
                        <th className="text-left p-4 text-muted font-medium">Domiciliario</th>
                        <th className="text-left p-4 text-muted font-medium">Estado</th>
                        <th className="text-left p-4 text-muted font-medium">Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enRuta.map((domicilio) => (
                        <tr key={domicilio.id} className="border-b border-border last:border-0 hover:bg-bg3 transition-colors">
                          <td className="p-4 text-text">{domicilio.cliente}</td>
                          <td className="p-4 text-text">{domicilio.direccion}</td>
                          <td className="p-4 text-text flex items-center gap-2">
                            <User className="w-4 h-4 text-muted" />
                            {domicilio.domiciliario}
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 bg-bg3 text-text px-2 py-1 rounded-full text-xs font-medium">
                              <Truck className="w-3 h-3" />
                              En ruta
                            </span>
                          </td>
                          <td className="p-4 text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {domicilio.hora}
                          </td>
                        </tr>
                      ))}
                      {enRuta.length === 0 && (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-muted">
                            No hay domicilios en ruta
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'completados' && (
              <motion.div
                key="completados"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-bg2 border border-border rounded-xl overflow-hidden"
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-4 text-muted font-medium">Cliente</th>
                        <th className="text-left p-4 text-muted font-medium">Dirección</th>
                        <th className="text-left p-4 text-muted font-medium">Domiciliario</th>
                        <th className="text-left p-4 text-muted font-medium">Valor</th>
                        <th className="text-left p-4 text-muted font-medium">Tiempo</th>
                        <th className="text-left p-4 text-muted font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completados.map((domicilio) => (
                        <tr key={domicilio.id} className="border-b border-border last:border-0 hover:bg-bg3 transition-colors">
                          <td className="p-4 text-text">{domicilio.cliente}</td>
                          <td className="p-4 text-text">{domicilio.direccion}</td>
                          <td className="p-4 text-text flex items-center gap-2">
                            <User className="w-4 h-4 text-muted" />
                            {domicilio.domiciliario}
                          </td>
                          <td className="p-4 text-accent font-semibold">${domicilio.valor?.toLocaleString()}</td>
                          <td className="p-4 text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {domicilio.tiempo}
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 bg-accent/20 text-accent px-2 py-1 rounded-full text-xs font-medium">
                              <CheckCircle className="w-3 h-3" />
                              Completado
                            </span>
                          </td>
                        </tr>
                      ))}
                      {completados.length === 0 && (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-muted">
                            No hay domicilios completados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'domiciliarios' && (
              <motion.div
                key="domiciliarios"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setShowDriverForm(true)}
                    className="flex items-center gap-2 bg-accent text-bg px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {drivers.map((driver) => (
                    <motion.div
                      key={driver.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-bg2 border border-border rounded-xl p-5"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-bg3 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-muted" />
                        </div>
                        <div>
                          <h3 className="text-text font-semibold">{driver.nombre}</h3>
                          <p className="text-muted text-sm flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {driver.telefono}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-bg3 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-text">{driver.pedidos_completados || 0}</p>
                          <p className="text-muted text-xs">Pedidos</p>
                        </div>
                        <div className="bg-bg3 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-text">{driver.km_totales || 0}</p>
                          <p className="text-muted text-xs">Km</p>
                        </div>
                        <div className="bg-bg3 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-accent">${(driver.ganancias_totales || 0).toLocaleString()}</p>
                          <p className="text-muted text-xs">Ganancias</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {drivers.length === 0 && (
                    <div className="col-span-full bg-bg2 border border-border rounded-xl p-8 text-center text-muted">
                      No hay domiciliarios registrados
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {showAssignModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAssignModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg2 border border-border rounded-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-lg font-semibold text-text">Asignar Domiciliario</h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-muted hover:text-text transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 max-h-80 overflow-y-auto">
                {drivers.length === 0 ? (
                  <p className="text-muted text-center py-8">
                    No hay domiciliarios disponibles
                  </p>
                ) : (
                  <div className="space-y-2">
                    {drivers.map((driver) => (
                      <button
                        key={driver.id}
                        onClick={() => handleAssign(selectedDomicilioId, driver.id)}
                        disabled={assignLoading}
                        className="w-full flex items-center gap-3 p-3 bg-bg3 rounded-lg hover:bg-bg border border-transparent hover:border-border transition-colors text-left disabled:opacity-50"
                      >
                        <div className="w-10 h-10 bg-bg2 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-muted" />
                        </div>
                        <div className="flex-1">
                          <p className="text-text font-medium">{driver.nombre}</p>
                          <p className="text-muted text-sm">{driver.telefono}</p>
                        </div>
                        {assignLoading && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {showDriverForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDriverForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg2 border border-border rounded-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-lg font-semibold text-text">Agregar Domiciliario</h3>
                <button
                  onClick={() => setShowDriverForm(false)}
                  className="text-muted hover:text-text transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddDriver} className="p-4 space-y-4">
                <div>
                  <label className="block text-muted text-sm mb-1">Nombre</label>
                  <input
                    type="text"
                    value={driverForm.nombre}
                    onChange={(e) => setDriverForm({ ...driverForm, nombre: e.target.value })}
                    className="w-full bg-bg3 border border-border rounded-lg px-4 py-2 text-text focus:outline-none focus:border-accent transition-colors"
                    placeholder="Nombre completo"
                    required
                  />
                </div>

                <div>
                  <label className="block text-muted text-sm mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={driverForm.telefono}
                    onChange={(e) => setDriverForm({ ...driverForm, telefono: e.target.value })}
                    className="w-full bg-bg3 border border-border rounded-lg px-4 py-2 text-text focus:outline-none focus:border-accent transition-colors"
                    placeholder="Número de teléfono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-muted text-sm mb-1">PIN</label>
                  <input
                    type="password"
                    value={driverForm.pin}
                    onChange={(e) => setDriverForm({ ...driverForm, pin: e.target.value })}
                    className="w-full bg-bg3 border border-border rounded-lg px-4 py-2 text-text focus:outline-none focus:border-accent transition-colors"
                    placeholder="PIN de acceso"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDriverForm(false)}
                    className="flex-1 bg-bg3 text-text py-2 rounded-lg font-medium hover:bg-border transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={assignLoading}
                    className="flex-1 bg-accent text-bg py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    {assignLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Agregar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
