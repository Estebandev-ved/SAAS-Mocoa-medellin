import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from './Modal';
import { formatDate } from './format';

export default function CancelarModal({ sub, enviando, onConfirm, onClose }) {
  const [motivo, setMotivo] = useState('');

  return (
    <Modal titulo="Cancelar suscripción" onClose={onClose} ancho="max-w-md">
      <p className="text-sm text-text">
        Tu plan <strong>{sub.plan_nombre}</strong> seguirá activo hasta el <strong>{formatDate(sub.acceso_hasta)}</strong> y no se
        renovará: no se te cobrará de nuevo. Puedes reactivarlo antes de esa fecha sin pagar otra vez.
      </p>

      <label htmlFor="motivo-cancelar" className="block text-sm font-semibold text-text mt-5 mb-2">
        ¿Nos cuentas por qué? <span className="font-normal text-muted">(opcional)</span>
      </label>
      <textarea
        id="motivo-cancelar"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={500}
        rows={3}
        className="w-full bg-white border border-[#C9C9C9] rounded-xl px-4 py-3 text-text text-sm placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-none"
        placeholder="Tu opinión nos ayuda a mejorar"
      />

      <div className="mt-6 flex gap-3 justify-end flex-wrap">
        <button
          type="button"
          onClick={onClose}
          data-autofocus
          className="h-11 px-5 rounded-xl bg-accent hover:bg-accent2 text-white text-sm font-semibold transition-colors"
        >
          Mantener mi plan
        </button>
        <button
          type="button"
          onClick={() => onConfirm(motivo)}
          disabled={enviando}
          className="h-11 px-5 rounded-xl bg-white hover:bg-bg2 text-danger-text text-sm font-semibold border border-danger/50 inline-flex items-center gap-2 transition-colors disabled:opacity-60"
        >
          {enviando && <Loader2 size={16} className="animate-spin" />}
          Cancelar suscripción
        </button>
      </div>
    </Modal>
  );
}
