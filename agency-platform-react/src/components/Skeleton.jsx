import React from 'react';

// Bloque gris pulsante para pantallas que cargan (mejor que un "0" o un spinner a pantalla completa).
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`noma-skeleton rounded-lg ${className}`} />;
}

export function SkeletonCards({ count = 4, className = '' }) {
  return (
    <div role="status" aria-label="Cargando" className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl p-6 border border-border bg-bg">
          <Skeleton className="h-3 w-24 mb-4" />
          <Skeleton className="h-8 w-32 mb-3" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
