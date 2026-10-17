import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { puede } from '../utils/capacidades'

// Perfil del negocio (tipo, ciudad…). Se pide una vez por sesión de navegador y se comparte entre
// pantallas; se refresca al cambiar de cuenta.
let cache = { id: null, perfil: null }

export function useNegocio() {
  const { user } = useAuth()
  const [perfil, setPerfil] = useState(cache.id === user?.id ? cache.perfil : null)

  useEffect(() => {
    if (!user?.id) return undefined
    if (cache.id === user.id && cache.perfil) return undefined
    let vivo = true
    api.get('/business/perfil')
      .then((r) => {
        cache = { id: user.id, perfil: r.data?.negocio || {} }
        if (vivo) setPerfil(cache.perfil)
      })
      .catch(() => { if (vivo) setPerfil({}) })
    return () => { vivo = false }
  }, [user?.id])

  // Ajustes avisa cuando cambia el tipo de negocio: se vuelve a pedir el perfil
  useEffect(() => {
    const recargar = () => {
      if (!user?.id) return
      api.get('/business/perfil').then((r) => {
        cache = { id: user.id, perfil: r.data?.negocio || {} }
        setPerfil(cache.perfil)
      }).catch(() => {})
    }
    window.addEventListener('negocio-actualizado', recargar)
    return () => window.removeEventListener('negocio-actualizado', recargar)
  }, [user?.id])

  const tipo = perfil?.tipo_negocio || null
  return { perfil, tipo, cargando: perfil === null, puede: (cap) => puede(cap, tipo) }
}

// Para que Ajustes invalide el dato después de cambiar el tipo de negocio
export const olvidarNegocio = () => { cache = { id: null, perfil: null } }
