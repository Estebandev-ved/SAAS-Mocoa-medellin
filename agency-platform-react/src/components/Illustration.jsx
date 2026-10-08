import bienvenida from '../assets/illustrations/bienvenida.svg';
import vacioPedidos from '../assets/illustrations/vacio-pedidos.svg';
import vacioDomicilios from '../assets/illustrations/vacio-domicilios.svg';
import exito from '../assets/illustrations/exito.svg';
import error from '../assets/illustrations/error.svg';
import carga from '../assets/illustrations/carga.svg';

const ILLUSTRATIONS = {
  bienvenida,
  'vacio-pedidos': vacioPedidos,
  'vacio-domicilios': vacioDomicilios,
  exito,
  error,
  carga,
};

// Personajes del elenco NOMA (design.md > Illustration & Characters).
// Se muestran sobre primary-soft con radio xl y al menos 24px de margen.
// Decorativas por defecto (alt=""); pasa `alt` si la ilustración informa algo.
export default function Illustration({ name, size = 160, alt = '', framed = true, style }) {
  const src = ILLUSTRATIONS[name];
  if (!src) return null;

  const img = (
    <img
      src={src}
      alt={alt}
      width={size}
      style={{ display: 'block', width: size, maxWidth: '100%', height: 'auto' }}
    />
  );

  if (!framed) return img;

  return (
    <div
      style={{
        display: 'inline-flex',
        background: '#FDECEA',
        borderRadius: 24,
        padding: 24,
        ...style,
      }}
    >
      {img}
    </div>
  );
}

// Personajes del elenco NOMA de cuerpo entero, sin fondo (para distribuirlos por la página).
import sofia from '../assets/illustrations/personaje-sofia.svg';
import mateo from '../assets/illustrations/personaje-mateo.svg';
import lucia from '../assets/illustrations/personaje-lucia.svg';
import nova from '../assets/illustrations/personaje-nova.svg';

const CHARACTERS = { sofia, mateo, lucia, nova };

export function Character({ name, height = 280, alt = '', className = '' }) {
  const src = CHARACTERS[name];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      height={height}
      className={className}
      style={{ display: 'block', height, width: 'auto', maxWidth: '100%' }}
    />
  );
}
