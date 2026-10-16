import { useCallback, useEffect, useState } from 'react'

const CLAVE = 'noma_tema'

const leer = () => {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado === 'oscuro' || guardado === 'claro') return guardado
  } catch { /* sin almacenamiento */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

const aplicar = (tema) => {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', tema === 'oscuro' ? '#0A0A0A' : '#E53935')
}

export function useTema() {
  const [tema, setTema] = useState(leer)

  useEffect(() => {
    const onStorage = (e) => e.key === CLAVE && setTema(leer())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const poner = useCallback((t) => {
    try { localStorage.setItem(CLAVE, t) } catch { /* sin almacenamiento */ }
    aplicar(t)
    setTema(t)
  }, [])

  const alternar = useCallback(() => poner(leer() === 'oscuro' ? 'claro' : 'oscuro'), [poner])

  return { tema, oscuro: tema === 'oscuro', poner, alternar }
}
