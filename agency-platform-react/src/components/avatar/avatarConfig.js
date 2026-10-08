// Avatar del dueño del negocio (personaje "Sofía" personalizable).
// Los ids DEBEN coincidir con antigravity/api/services/avatar.js (validación en el servidor).

export const GENEROS = [
  { id: 'mujer', label: 'Mujer' },
  { id: 'hombre', label: 'Hombre' },
  { id: 'neutro', label: 'Prefiero no decirlo' },
];

export const PIEL = [
  { id: 'p1', label: 'Muy claro', base: '#FBE4DC', shade: '#F5D0C5' },
  { id: 'p2', label: 'Claro', base: '#F3CBB0', shade: '#E8B99B' },
  { id: 'p3', label: 'Medio', base: '#E0A882', shade: '#CF946C' },
  { id: 'p4', label: 'Trigueño', base: '#C68863', shade: '#B5754F' },
  { id: 'p5', label: 'Oscuro', base: '#9A6240', shade: '#8A5333' },
  { id: 'p6', label: 'Muy oscuro', base: '#6B4229', shade: '#5B361F' },
];

export const PELO_ESTILOS = [
  { id: 'mono', label: 'Moño' },
  { id: 'corto', label: 'Corto' },
  { id: 'largo', label: 'Largo' },
  { id: 'rizado', label: 'Rizado' },
  { id: 'afro', label: 'Afro' },
  { id: 'rapado', label: 'Rapado' },
  { id: 'calvo', label: 'Calvo' },
];

export const PELO_COLORES = [
  { id: 'negro', label: 'Negro', hex: '#0A0A0A' },
  { id: 'castano_oscuro', label: 'Castaño oscuro', hex: '#3B2417' },
  { id: 'castano', label: 'Castaño', hex: '#6B4226' },
  { id: 'rubio', label: 'Rubio', hex: '#D9B26A' },
  { id: 'pelirrojo', label: 'Pelirrojo', hex: '#A5431F' },
  { id: 'gris', label: 'Gris', hex: '#A0A0A0' },
  { id: 'blanco', label: 'Blanco', hex: '#E8E8E8' },
];

export const BARBAS = [
  { id: 'ninguna', label: 'Sin barba' },
  { id: 'sombra', label: 'Sombra' },
  { id: 'bigote', label: 'Bigote' },
  { id: 'corta', label: 'Corta' },
  { id: 'larga', label: 'Larga' },
];

export const GAFAS = [
  { id: 'ninguna', label: 'Sin gafas' },
  { id: 'redondas', label: 'Redondas' },
  { id: 'cuadradas', label: 'Cuadradas' },
  { id: 'sol', label: 'De sol' },
];

export const ARETES = [
  { id: 'ninguno', label: 'Sin aretes' },
  { id: 'botones', label: 'Botones' },
  { id: 'aros', label: 'Aros' },
];

export const PECAS = [
  { id: 'ninguna', label: 'Sin pecas' },
  { id: 'con_pecas', label: 'Con pecas' },
];

export const GORRA_TIPOS = [
  { id: 'ninguna', label: 'Sin gorra' },
  { id: 'plana', label: 'Gorra plana' },
];

export const GORRA_COLORES = [
  { id: 'rojo', label: 'Rojo NOMA', fill: '#E53935', detail: '#C62828' },
  { id: 'negro', label: 'Negro', fill: '#262626', detail: '#404040' },
  { id: 'blanco', label: 'Blanco', fill: '#FFFFFF', detail: '#C9C9C9' },
];

export const TATUAJES = [
  { id: 'ninguno', label: 'Ninguno' },
  { id: 'brazo', label: 'Brazo' },
  { id: 'cuello', label: 'Cuello' },
  { id: 'ambos', label: 'Brazo y cuello' },
];

export const ROPA_TIPOS = [
  { id: 'chaqueta', label: 'Chaqueta' },
  { id: 'camiseta', label: 'Camiseta' },
];

export const ROPA_COLORES = [
  { id: 'rojo', label: 'Rojo NOMA', fill: '#E53935', detail: '#C62828', inner: '#FFFFFF' },
  { id: 'negro', label: 'Negro', fill: '#262626', detail: '#404040', inner: '#FFFFFF' },
  { id: 'blanco', label: 'Blanco', fill: '#FFFFFF', detail: '#C9C9C9', inner: '#E4E4E4' },
  { id: 'gris', label: 'Gris', fill: '#A0A0A0', detail: '#666666', inner: '#F0F0F0' },
];

// Sofía tal como aparece en la marca
export const DEFAULT_AVATAR = {
  v: 1,
  genero: 'mujer',
  piel: 'p1',
  pelo: { estilo: 'mono', color: 'negro' },
  barba: 'ninguna',
  gafas: 'ninguna',
  aretes: 'botones',
  pecas: 'ninguna',
  gorra: { tipo: 'ninguna', color: 'rojo' },
  tatuajes: 'ninguno',
  ropa: { tipo: 'chaqueta', color: 'rojo' },
};

const ids = (list) => list.map((o) => o.id);
const pick = (value, list, fallback) => (ids(list).includes(value) ? value : fallback);

// Normaliza cualquier entrada: ids desconocidos vuelven al valor por defecto.
export function sanitizeAvatar(input) {
  const a = input && typeof input === 'object' ? input : {};
  const d = DEFAULT_AVATAR;
  return {
    v: 1,
    genero: pick(a.genero, GENEROS, d.genero),
    piel: pick(a.piel, PIEL, d.piel),
    pelo: {
      estilo: pick(a.pelo?.estilo, PELO_ESTILOS, d.pelo.estilo),
      color: pick(a.pelo?.color, PELO_COLORES, d.pelo.color),
    },
    barba: pick(a.barba, BARBAS, d.barba),
    gafas: pick(a.gafas, GAFAS, d.gafas),
    aretes: pick(a.aretes, ARETES, d.aretes),
    pecas: pick(a.pecas, PECAS, d.pecas),
    gorra: {
      tipo: pick(a.gorra?.tipo, GORRA_TIPOS, d.gorra.tipo),
      color: pick(a.gorra?.color, GORRA_COLORES, d.gorra.color),
    },
    tatuajes: pick(a.tatuajes, TATUAJES, d.tatuajes),
    ropa: {
      tipo: pick(a.ropa?.tipo, ROPA_TIPOS, d.ropa.tipo),
      color: pick(a.ropa?.color, ROPA_COLORES, d.ropa.color),
    },
  };
}

const rnd = (list) => list[Math.floor(Math.random() * list.length)].id;

export function randomAvatar() {
  return sanitizeAvatar({
    genero: rnd(GENEROS),
    piel: rnd(PIEL),
    pelo: { estilo: rnd(PELO_ESTILOS), color: rnd(PELO_COLORES) },
    barba: Math.random() < 0.5 ? 'ninguna' : rnd(BARBAS),
    gafas: Math.random() < 0.5 ? 'ninguna' : rnd(GAFAS),
    aretes: Math.random() < 0.5 ? 'ninguno' : rnd(ARETES.filter((o) => o.id !== 'ninguno')),
    pecas: Math.random() < 0.7 ? 'ninguna' : 'con_pecas',
    gorra: Math.random() < 0.75 ? { tipo: 'ninguna', color: 'rojo' } : { tipo: 'plana', color: rnd(GORRA_COLORES) },
    tatuajes: Math.random() < 0.6 ? 'ninguno' : rnd(TATUAJES),
    ropa: { tipo: rnd(ROPA_TIPOS), color: rnd(ROPA_COLORES) },
  });
}

export const byId = (list, id) => list.find((o) => o.id === id) || list[0];
