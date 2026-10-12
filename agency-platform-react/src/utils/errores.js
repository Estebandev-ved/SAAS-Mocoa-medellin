// Convierte un error de axios en una frase que le diga al dueño qué pasó y qué hacer.
// `accion` completa la frase genérica: "No se pudo {accion}".
export function mensajeError(err, accion = 'completar la acción') {
  const status = err?.response?.status;
  const servidor = err?.response?.data?.error;

  if (!err?.response) {
    return `No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo (no se pudo ${accion}).`;
  }
  if (status === 401) return 'Tu sesión venció. Vuelve a iniciar sesión para continuar.';
  if (status === 403) return servidor || 'Tu plan no incluye esta función. Puedes subir de plan desde Suscripción.';
  if (status === 429) return 'Hiciste muchas peticiones seguidas. Espera un minuto e inténtalo de nuevo.';
  if (status === 502 || status === 503) {
    return servidor || `El servicio no está disponible en este momento. Si usas WhatsApp, revisa que esté conectado (WhatsApp → escanear QR) e inténtalo de nuevo.`;
  }
  if (status >= 500) return `Algo falló de nuestro lado y no se pudo ${accion}. Inténtalo de nuevo en un momento; si sigue igual, escríbenos.`;
  return servidor || `No se pudo ${accion}. Revisa los datos e inténtalo de nuevo.`;
}
