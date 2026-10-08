import React from 'react';
import Illustration, { Character } from './Illustration';
import OwnerAvatar from './avatar/OwnerAvatar';
import CheckBadge from './CheckBadge';
import { useAuth } from '../context/AuthContext';

// Estado vacío o de error con personaje (design.md: un personaje en cada estado vacío, de éxito y de error).
// name: 'vacio-pedidos' | 'vacio-domicilios' | 'error' | 'exito' (ilustración fija de Illustration.jsx)
// character: 'sofia' | 'mateo' | 'lucia' | 'nova' — para estados vacíos que no tienen una
// ilustración propia todavía; se usa el mismo personaje enmarcado que ya se ve en el modal
// de hitos (HitosContext) y en el vacío principal de Conversaciones, en vez de dejar que
// `name` caiga en 'vacio-pedidos' por defecto y muestre un ícono que no tiene que ver.
// name="exito": si el dueño ya tiene su propio avatar, se muestra ese (con el mismo sello
// de "hecho" que ya usa el toast de éxito) en vez de la Sofía genérica — mismo criterio
// que Toast.jsx ya aplica para no tener dos reglas distintas de "cuándo mostrar tu avatar".
export default function EmptyState({
  name,
  character,
  title,
  description,
  action,
  size = 160,
  alt = '',
  className = '',
}) {
  const { user } = useAuth();
  const conAvatar = name === 'exito' && !!user?.avatar;

  return (
    <div className={`flex flex-col items-center text-center py-12 px-4 ${className}`}>
      {conAvatar ? (
        <div
          className="relative rounded-2xl bg-[#FDECEA] flex items-end justify-center overflow-hidden"
          style={{ width: size, height: size }}
        >
          <OwnerAvatar config={user.avatar} variant="busto" height={size * 0.9} label={alt || 'Tu avatar celebra'} />
          <CheckBadge size={size * 0.22} className="absolute bottom-1 right-1" />
        </div>
      ) : character ? (
        <div
          className="rounded-2xl bg-[#FDECEA] flex items-end justify-center overflow-hidden"
          style={{ width: size, height: size }}
        >
          <Character name={character} height={size * 0.9} alt={alt} />
        </div>
      ) : (
        <Illustration name={name || 'vacio-pedidos'} size={size} alt={alt} />
      )}
      {title && <h3 className="text-xl font-bold mt-6 mb-2">{title}</h3>}
      {description && <p className="text-muted text-sm max-w-md">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
