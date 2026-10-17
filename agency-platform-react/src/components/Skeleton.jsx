import React from 'react'

// Esqueleto de carga: mantiene la forma del contenido final (sin saltos) y respeta
// prefers-reduced-motion (ver index.css, clase .skeleton).
export function Skeleton({ className = '', style }) {
  return <div aria-hidden="true" className={`skeleton rounded-xl ${className}`} style={style} />
}

export function SkeletonCards({ n = 4 }) {
  return (
    <div role="status" aria-label="Cargando" className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-border">
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonList({ filas = 5 }) {
  return (
    <div role="status" aria-label="Cargando" className="bg-white rounded-2xl border border-border divide-y divide-border">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="p-4 flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-3.5 w-1/3 mb-2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default Skeleton
