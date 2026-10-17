import React from 'react';
import { GRUPOS_TIPO, ETIQUETA_TIPO } from '../utils/tiposNegocio';

// Lista agrupada de tipos de negocio para elegir (en vez de escribirlos).
// Si el negocio ya tiene un valor que no está en el catálogo, se muestra tal cual para no perderlo.
export default function SelectorTipoNegocio({ value, onChange, className = '', name = 'tipo_negocio', ...rest }) {
  const desconocido = value && !ETIQUETA_TIPO[value];
  return (
    <select name={name} value={value || ''} onChange={onChange} className={className} {...rest}>
      <option value="">Elige el tipo de negocio…</option>
      {desconocido && <option value={value}>{value}</option>}
      {GRUPOS_TIPO.map((g) => (
        <optgroup key={g.id} label={g.label}>
          {g.tipos.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
