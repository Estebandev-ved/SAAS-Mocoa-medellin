// Avatar del dueño del negocio: validación en el servidor.
// Los ids DEBEN coincidir con agency-platform-react/src/components/avatar/avatarConfig.js
// Se valida contra una lista blanca para no guardar nunca contenido arbitrario del cliente.

const OPCIONES = {
  genero: ['mujer', 'hombre', 'neutro'],
  piel: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
  peloEstilo: ['mono', 'corto', 'largo', 'rizado', 'afro', 'rapado', 'calvo'],
  peloColor: ['negro', 'castano_oscuro', 'castano', 'rubio', 'pelirrojo', 'gris', 'blanco'],
  barba: ['ninguna', 'sombra', 'bigote', 'corta', 'larga'],
  gafas: ['ninguna', 'redondas', 'cuadradas', 'sol'],
  tatuajes: ['ninguno', 'brazo', 'cuello', 'ambos'],
  ropaTipo: ['chaqueta', 'camiseta'],
  ropaColor: ['rojo', 'negro', 'blanco', 'gris'],
};

const DEFAULT_AVATAR = {
  v: 1,
  genero: 'mujer',
  piel: 'p1',
  pelo: { estilo: 'mono', color: 'negro' },
  barba: 'ninguna',
  gafas: 'ninguna',
  tatuajes: 'ninguno',
  ropa: { tipo: 'chaqueta', color: 'rojo' },
};

const pick = (value, lista, fallback) => (lista.includes(value) ? value : fallback);

function sanitizeAvatar(input) {
  const a = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const d = DEFAULT_AVATAR;
  return {
    v: 1,
    genero: pick(a.genero, OPCIONES.genero, d.genero),
    piel: pick(a.piel, OPCIONES.piel, d.piel),
    pelo: {
      estilo: pick(a.pelo && a.pelo.estilo, OPCIONES.peloEstilo, d.pelo.estilo),
      color: pick(a.pelo && a.pelo.color, OPCIONES.peloColor, d.pelo.color),
    },
    barba: pick(a.barba, OPCIONES.barba, d.barba),
    gafas: pick(a.gafas, OPCIONES.gafas, d.gafas),
    tatuajes: pick(a.tatuajes, OPCIONES.tatuajes, d.tatuajes),
    ropa: {
      tipo: pick(a.ropa && a.ropa.tipo, OPCIONES.ropaTipo, d.ropa.tipo),
      color: pick(a.ropa && a.ropa.color, OPCIONES.ropaColor, d.ropa.color),
    },
  };
}

// Lee el JSON guardado en la columna avatar_config; si es nulo o está corrupto devuelve null
// (el frontend usa entonces el avatar por defecto).
function parseAvatar(raw) {
  if (!raw) return null;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return sanitizeAvatar(obj);
  } catch (e) {
    return null;
  }
}

module.exports = { sanitizeAvatar, parseAvatar, DEFAULT_AVATAR };
