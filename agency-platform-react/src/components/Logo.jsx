// Logo de Antigravity: "A" con una esfera flotando dentro (ingravidez), sobre cuadrado rojo.
// Mismo dibujo que public/favicon.svg y public/logo/*.svg.
export function LogoMark({ size = 32, className = '', title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="512" height="512" rx="116" fill="#E53935" />
      <path d="M140 376L256 144L372 376" fill="none" stroke="#fff" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="256" cy="302" r="32" fill="#fff" />
    </svg>
  )
}

// tone: 'dark' = texto oscuro (fondos claros), 'light' = texto blanco (fondos oscuros)
export default function Logo({ size = 32, tone = 'dark', name = 'antigravity', showName = true, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={size} />
      {showName && (
        <span
          className={`font-head font-extrabold tracking-[-0.02em] leading-none ${tone === 'light' ? 'text-white' : 'text-[#0A0A0A]'}`}
          style={{ fontSize: Math.round(size * 0.66) }}
        >
          {name}
        </span>
      )}
    </span>
  )
}
