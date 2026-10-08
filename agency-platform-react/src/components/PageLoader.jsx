import Illustration from './Illustration';

// Spinner de sección/página con Nova (carga.svg ya trae su propia animación
// de giro), en vez del ícono genérico Loader2. Para spinners diminutos dentro
// de un botón (guardando...) se sigue usando Loader2 — Nova no se lee bien a 16px.
export default function PageLoader({ size = 72, className = '' }) {
  return (
    <div className={`flex justify-center py-12 ${className}`}>
      <Illustration name="carga" size={size} framed={false} alt="Cargando" />
    </div>
  );
}
