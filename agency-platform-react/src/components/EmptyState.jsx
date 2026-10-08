import React from 'react';
import Illustration from './Illustration';

// Estado vacío o de error con personaje (design.md: un personaje en cada estado vacío, de éxito y de error).
// name: 'vacio-pedidos' | 'vacio-domicilios' | 'error' | 'exito'
export default function EmptyState({
  name = 'vacio-pedidos',
  title,
  description,
  action,
  size = 160,
  alt = '',
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center text-center py-12 px-4 ${className}`}>
      <Illustration name={name} size={size} alt={alt} />
      {title && <h3 className="text-xl font-bold mt-6 mb-2">{title}</h3>}
      {description && <p className="text-muted text-sm max-w-md">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
