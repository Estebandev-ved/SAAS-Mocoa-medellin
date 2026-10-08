import React from 'react';
import { PIEL, PELO_COLORES, ROPA_COLORES, GORRA_COLORES, sanitizeAvatar, byId } from './avatarConfig';

// Avatar del dueño: mismo estilo y coordenadas que el personaje "Sofía" (contorno 2px, formas planas),
// dibujado por capas para poder combinar género, piel, pelo, barba, gafas, aretes, pecas, gorra, tatuajes y ropa.
const OUT = '#0A0A0A';

// Proporciones por género (hombros, cuello, cejas) — los aretes ya no dependen del género,
// son una opción propia (ver ARETES en avatarConfig.js).
const GENERO = {
  mujer: { sx: 1, neck: 9, brow: 2, lashes: true, blush: 0.6 },
  hombre: { sx: 1.14, neck: 11, brow: 3.2, lashes: false, blush: 0 },
  neutro: { sx: 1.06, neck: 10, brow: 2.5, lashes: false, blush: 0.35 },
};

const RA = 'M-44 218 L-65 285 C-68 293 -62 302 -52 305 L-30 308'; // brazo con tableta
const LA = 'M44 218 L60 285 C62 296 58 315 50 325'; // brazo suelto

function BackHair({ estilo, hair }) {
  const p = { fill: hair, stroke: OUT, strokeWidth: 2, strokeLinejoin: 'round' };
  switch (estilo) {
    case 'mono':
      return <ellipse cx="0" cy="98" rx="26" ry="24" {...p} />;
    case 'largo':
      return <path d="M-40 122 C-46 88 -20 82 0 82 C20 82 46 88 40 122 L46 206 C46 214 36 216 28 214 L-28 214 C-36 216 -46 214 -46 206 Z" {...p} />;
    case 'rizado':
      return (
        <g {...p}>
          <circle cx="-31" cy="120" r="14" />
          <circle cx="-23" cy="101" r="15" />
          <circle cx="-8" cy="92" r="15" />
          <circle cx="8" cy="92" r="15" />
          <circle cx="23" cy="101" r="15" />
          <circle cx="31" cy="120" r="14" />
        </g>
      );
    case 'afro':
      return <circle cx="0" cy="112" r="46" {...p} />;
    default:
      return null;
  }
}

function FrontHair({ estilo, hair }) {
  const p = { fill: hair, stroke: OUT, strokeWidth: 2, strokeLinejoin: 'round' };
  switch (estilo) {
    case 'mono':
      return <path d="M-36 132 C-34 95 -10 90 0 90 C15 90 35 96 36 132 C28 116 12 110 -2 112 C-18 114 -28 122 -36 132 Z" {...p} />;
    case 'corto':
      return <path d="M-37 134 C-39 96 -12 88 0 88 C14 88 39 96 37 134 C31 116 16 106 0 108 C-14 106 -30 116 -37 134 Z" {...p} />;
    case 'largo':
      return <path d="M-37 134 C-39 96 -12 88 0 88 C14 88 39 96 37 134 C30 120 14 112 0 106 C-14 112 -30 120 -37 134 Z" {...p} />;
    case 'rizado':
      return (
        <g {...p}>
          <circle cx="-22" cy="112" r="10" />
          <circle cx="-7" cy="106" r="10" />
          <circle cx="8" cy="106" r="10" />
          <circle cx="22" cy="112" r="10" />
        </g>
      );
    case 'afro':
      return <path d="M-34 128 C-32 108 -10 102 0 102 C10 102 32 108 34 128 C26 116 12 112 0 112 C-12 112 -26 116 -34 128 Z" {...p} />;
    case 'rapado':
      return <path d="M-35 128 C-35 102 -14 98 0 98 C14 98 35 102 35 128 C28 114 12 108 0 108 C-12 108 -28 114 -35 128 Z" fill={hair} opacity="0.55" />;
    default:
      return null;
  }
}

const BEARD_FULL = 'M-35 146 C-34 158 -26 152 -14 153 C-8 151 8 151 14 153 C26 152 34 158 35 146 C33 168 16 181 0 181 C-16 181 -33 168 -35 146 Z';
const BEARD_LONG = 'M-35 146 C-34 158 -26 152 -14 153 C-8 151 8 151 14 153 C26 152 34 158 35 146 C38 176 22 196 0 202 C-22 196 -38 176 -35 146 Z';

function Glasses({ tipo }) {
  const s = { stroke: OUT, strokeWidth: 2.5, strokeLinecap: 'round' };
  if (tipo === 'redondas') {
    return (
      <g fill="#FFFFFF" fillOpacity="0.18" {...s}>
        <circle cx="-13" cy="138" r="10.5" />
        <circle cx="13" cy="138" r="10.5" />
        <path d="M-2.5 138 L2.5 138" fill="none" />
        <path d="M-23.5 138 L-35 140 M23.5 138 L35 140" fill="none" />
      </g>
    );
  }
  if (tipo === 'cuadradas') {
    return (
      <g fill="#FFFFFF" fillOpacity="0.18" {...s} strokeLinejoin="round">
        <rect x="-25" y="130" width="21" height="16" rx="4" />
        <rect x="4" y="130" width="21" height="16" rx="4" />
        <path d="M-4 137 L4 137" fill="none" />
        <path d="M-25 136 L-35 138 M25 136 L35 138" fill="none" />
      </g>
    );
  }
  if (tipo === 'sol') {
    return (
      <g {...s} strokeLinejoin="round">
        <rect x="-25" y="130" width="21" height="16" rx="6" fill={OUT} />
        <rect x="4" y="130" width="21" height="16" rx="6" fill={OUT} />
        <path d="M-4 137 L4 137" fill="none" />
        <path d="M-25 136 L-35 138 M25 136 L35 138" fill="none" />
        <path d="M-21 134 L-15 134 M8 134 L14 134" stroke="#FFFFFF" strokeWidth="1.6" fill="none" />
      </g>
    );
  }
  return null;
}

function Cap({ tipo, cloth }) {
  if (tipo !== 'plana') return null;
  return (
    <g stroke={OUT} strokeWidth="2" strokeLinejoin="round">
      <path d="M-36 122 C-36 98 -18 84 0 84 C18 84 36 98 36 122 C36 126 33 128 29 128 L-29 128 C-33 128 -36 126 -36 122 Z" fill={cloth.fill} />
      <path d="M-33 126 C-14 118 14 118 36 126 L40 134 C14 126 -14 126 -37 134 Z" fill={cloth.detail} />
    </g>
  );
}

export default function OwnerAvatar({
  config,
  variant = 'cuerpo', // 'cuerpo' | 'busto'
  height = 320,
  className = '',
  label = 'Avatar del dueño del negocio',
}) {
  const c = sanitizeAvatar(config);
  const skin = byId(PIEL, c.piel);
  const hair = byId(PELO_COLORES, c.pelo.color).hex;
  const cloth = byId(ROPA_COLORES, c.ropa.color);
  const gorraCloth = byId(GORRA_COLORES, c.gorra.color);
  const conGorra = c.gorra.tipo === 'plana';
  const g = GENERO[c.genero];
  const browColor = ['gris', 'blanco'].includes(c.pelo.color) ? '#666666' : hair === '#0A0A0A' ? OUT : hair;
  const camiseta = c.ropa.tipo === 'camiseta';
  const tatBrazo = c.tatuajes === 'brazo' || c.tatuajes === 'ambos';
  const tatCuello = c.tatuajes === 'cuello' || c.tatuajes === 'ambos';
  const conBarba = c.barba === 'corta' || c.barba === 'larga';

  const viewBox = variant === 'busto' ? '-62 60 124 168' : '-80 60 160 440';
  const width = variant === 'busto' ? (height * 124) / 168 : (height * 160) / 440;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={width}
      height={height}
      fill="none"
      role="img"
      aria-label={label}
      className={className}
      style={{ display: 'block', maxWidth: '100%' }}
    >
      {variant === 'cuerpo' && <ellipse cx="0" cy="495" rx="72" ry="9" fill={OUT} opacity="0.08" />}

      {/* Piernas y zapatos */}
      <path d="M-28 350 L-32 480 L-6 480 L-4 350 Z" fill={OUT} stroke={OUT} strokeWidth="2" strokeLinejoin="round" />
      <path d="M4 350 L6 480 L32 480 L28 350 Z" fill={OUT} stroke={OUT} strokeWidth="2" strokeLinejoin="round" />
      <path d="M-44 474 C-44 474 -34 466 -6 466 C4 466 7 475 7 484 C7 488 -39 488 -44 484 Z" fill="#FFFFFF" stroke={OUT} strokeWidth="2" />
      <path d="M-38 480 L-6 480" stroke="#E53935" strokeWidth="3" strokeLinecap="round" />
      <path d="M-7 466 C-7 466 3 466 31 466 C41 466 44 475 44 484 C44 488 -2 488 -7 484 Z" fill="#FFFFFF" stroke={OUT} strokeWidth="2" />
      <path d="M3 480 L35 480" stroke="#E53935" strokeWidth="3" strokeLinecap="round" />

      {/* Torso, brazos y tableta (se ensanchan según el género) */}
      <g transform={`scale(${g.sx} 1)`}>
        <path d="M-20 220 L20 220 L15 355 L-15 355 Z" fill={cloth.inner} />
        <path
          d="M-45 220 C-45 204 -25 195 0 195 C25 195 45 204 45 220 L55 352 C55 360 46 366 34 366 L-34 366 C-46 366 -55 360 -55 352 Z"
          fill={cloth.fill}
          stroke={OUT}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {camiseta ? (
          <path d="M-13 197 C-6 210 6 210 13 197" stroke={OUT} strokeWidth="2" strokeLinecap="round" />
        ) : (
          <>
            <path d="M0 195 L0 366" stroke={OUT} strokeWidth="2" strokeDasharray="6,3" />
            <path d="M-22 230 L-22 320" stroke={cloth.detail} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M22 230 L22 320" stroke={cloth.detail} strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}
        <rect x="-32" y="222" width="12" height="12" rx="3" fill="#FFFFFF" stroke={OUT} strokeWidth="1.5" />
        <rect x="-27" y="227" width="5" height="5" fill="#E53935" transform="rotate(45 -24.5 229.5)" />

        {/* Brazos */}
        {camiseta ? (
          <>
            {[RA, LA].map((d, i) => (
              <g key={i}>
                <path d={d} pathLength="100" strokeDasharray="0 30 70" stroke={OUT} strokeWidth="24" fill="none" strokeLinejoin="round" />
                <path d={d} pathLength="100" strokeDasharray="0 30 70" stroke={skin.base} strokeWidth="20" fill="none" strokeLinejoin="round" />
                <path d={d} pathLength="100" strokeDasharray="32 68" stroke={cloth.fill} strokeWidth="20" fill="none" strokeLinejoin="round" />
                <path d={d} pathLength="100" strokeDasharray="32 68" stroke={OUT} strokeWidth="2" fill="none" strokeLinejoin="round" />
              </g>
            ))}
          </>
        ) : (
          <>
            <path d={RA} stroke={cloth.fill} strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d={RA} stroke={OUT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d={LA} stroke={cloth.fill} strokeWidth="20" strokeLinecap="round" fill="none" />
            <path d={LA} stroke={OUT} strokeWidth="2" strokeLinecap="round" fill="none" />
          </>
        )}

        {/* Mano suelta */}
        <ellipse cx="48" cy="328" rx="7" ry="9" fill={skin.base} stroke={OUT} strokeWidth="1.5" />

        {/* Tatuajes de brazo: antebrazo (camiseta) o dorso de la mano (chaqueta) */}
        {tatBrazo && camiseta && (
          <g stroke={OUT} strokeWidth="2" strokeLinecap="round">
            <path d="M51 294 L69 294" strokeDasharray="5 2.5" />
            <path d="M49 302 L67 302" strokeDasharray="2.5 2.5" />
            <path d="M47 310 L65 310" strokeDasharray="5 2.5" />
            <path d="M57 318 l3 -3 l3 3 l-3 3 z" fill={OUT} />
          </g>
        )}
        {tatBrazo && !camiseta && (
          <g stroke={OUT} strokeWidth="1.3" strokeLinecap="round">
            <path d="M44 323 L52 323" />
            <path d="M44 327 L52 327" />
            <path d="M45 331 L51 331" />
          </g>
        )}

        {/* Tableta */}
        <g transform="translate(-62, 280) rotate(-8)">
          <rect x="0" y="0" width="38" height="52" rx="4" fill={OUT} stroke={OUT} strokeWidth="2" />
          <rect x="3" y="3" width="32" height="46" rx="2" fill="#FFFFFF" />
          <rect x="6" y="8" width="16" height="4" rx="1" fill="#E53935" />
          <rect x="6" y="15" width="26" height="2" rx="1" fill="#CCCCCC" />
          <rect x="6" y="20" width="20" height="2" rx="1" fill="#CCCCCC" />
          <rect x="6" y="36" width="5" height="8" rx="1" fill={OUT} />
          <rect x="13" y="30" width="5" height="14" rx="1" fill="#E53935" />
          <rect x="20" y="26" width="5" height="18" rx="1" fill={OUT} />
          <ellipse cx="28" cy="46" rx="6" ry="5" fill={skin.base} stroke={OUT} strokeWidth="1.5" />
        </g>
      </g>

      {/* Pelo trasero */}
      <BackHair estilo={c.pelo.estilo} hair={hair} />

      {/* Cuello */}
      <rect x={-g.neck} y="165" width={g.neck * 2} height="34" rx="3" fill={skin.shade} stroke={OUT} strokeWidth="2" />
      {tatCuello && (
        <g fill={OUT} stroke={OUT} strokeLinecap="round">
          <path d="M3 184 l4 -3 l4 3 l-4 3 z" />
          <path d="M3 191 L11 191" strokeWidth="1.6" strokeDasharray="3 2" />
        </g>
      )}

      {/* Cabeza y orejas */}
      <ellipse cx="0" cy="140" rx="36" ry="40" fill={skin.base} stroke={OUT} strokeWidth="2" />
      <circle cx="-35" cy="142" r="5" fill={skin.base} stroke={OUT} strokeWidth="1.5" />
      <circle cx="35" cy="142" r="5" fill={skin.base} stroke={OUT} strokeWidth="1.5" />
      {c.aretes === 'botones' && (
        <>
          <circle cx="-35" cy="144" r="1.5" fill="#FFFFFF" />
          <circle cx="35" cy="144" r="1.5" fill="#FFFFFF" />
        </>
      )}
      {c.aretes === 'aros' && (
        <>
          <circle cx="-35" cy="149" r="4" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="35" cy="149" r="4" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
        </>
      )}

      {/* Barba (bajo los rasgos) */}
      {c.barba === 'sombra' && <path d={BEARD_FULL} fill={hair} opacity="0.3" />}
      {c.barba === 'corta' && <path d={BEARD_FULL} fill={hair} stroke={OUT} strokeWidth="2" strokeLinejoin="round" />}
      {c.barba === 'larga' && <path d={BEARD_LONG} fill={hair} stroke={OUT} strokeWidth="2" strokeLinejoin="round" />}
      {conBarba && <ellipse cx="0" cy="157" rx="11" ry="6" fill={skin.base} />}

      {/* Rostro */}
      <path d="M-19 130 C-15 127 -9 127 -6 130" stroke={browColor} strokeWidth={g.brow} strokeLinecap="round" />
      <path d="M6 130 C9 127 15 127 19 130" stroke={browColor} strokeWidth={g.brow} strokeLinecap="round" />
      <circle cx="-13" cy="138" r="3" fill={OUT} />
      <circle cx="13" cy="138" r="3" fill={OUT} />
      {g.lashes && (
        <g stroke={OUT} strokeWidth="1.6" strokeLinecap="round">
          <path d="M-16.5 136 L-19 133.5" />
          <path d="M16.5 136 L19 133.5" />
        </g>
      )}
      {g.blush > 0 && (
        <>
          <ellipse cx="-20" cy="148" rx="6" ry="3" fill="#EF9A9A" opacity={g.blush} />
          <ellipse cx="20" cy="148" rx="6" ry="3" fill="#EF9A9A" opacity={g.blush} />
        </>
      )}
      {c.pecas === 'con_pecas' && (
        <g fill="#8A5333" opacity="0.55">
          <circle cx="-22" cy="143" r="1.1" />
          <circle cx="-18" cy="146" r="1.1" />
          <circle cx="-24" cy="147" r="0.9" />
          <circle cx="22" cy="143" r="1.1" />
          <circle cx="18" cy="146" r="1.1" />
          <circle cx="24" cy="147" r="0.9" />
        </g>
      )}
      <path d="M-8 155 C-4 160 4 160 8 155" stroke={OUT} strokeWidth="2.2" strokeLinecap="round" />

      {/* Bigote */}
      {c.barba === 'bigote' && (
        <path d="M-15 153 C-9 146 -2 149 0 151 C2 149 9 146 15 153 C9 157 2 154 0 154 C-2 154 -9 157 -15 153 Z" fill={hair} stroke={OUT} strokeWidth="1.5" strokeLinejoin="round" />
      )}

      {/* Pelo delantero, gorra (cubre el pelo delantero si está puesta) y gafas */}
      {!conGorra && <FrontHair estilo={c.pelo.estilo} hair={hair} />}
      <Cap tipo={c.gorra.tipo} cloth={gorraCloth} />
      <Glasses tipo={c.gafas} />
    </svg>
  );
}
