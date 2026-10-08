import bienvenida from '../../assets/illustrations/bienvenida.svg';
import vacioPedidos from '../../assets/illustrations/vacio-pedidos.svg';
import vacioDomicilios from '../../assets/illustrations/vacio-domicilios.svg';
import exito from '../../assets/illustrations/exito.svg';
import error from '../../assets/illustrations/error.svg';
import carga from '../../assets/illustrations/carga.svg';

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
