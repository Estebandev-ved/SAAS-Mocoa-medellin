import { familiaDe } from './tiposNegocio';

// Qué herramientas ve cada tipo de negocio. Una sola tabla: para dar o quitar una herramienta a un
// tipo se edita aquí y el menú, las rutas y los atajos se ajustan solos.
//
// Regla: el núcleo (pedidos, conversaciones, productos, clientes, campañas, automatizaciones,
// suscripción) lo ven TODOS. Aquí solo van las herramientas que tienen sentido para un giro concreto.
// Las capacidades se definen por FAMILIA (restaurante, retail, servicios…): cualquier tipo del
// catálogo (granizados, pizzería, ropa…) hereda las de su familia (ver utils/tiposNegocio.js).
// Un tipo desconocido o vacío recibe solo el núcleo.
export const TIPOS_CON_DOMICILIO = ['restaurante', 'retail'];

export const CAPACIDADES = {
  // Pantalla grande para cocina: pedidos pagados por preparar con botón gigante "Listo"
  cocina: ['restaurante'],
  // Domicilios / restaurantes / mapa de repartidores
  domicilios: TIPOS_CON_DOMICILIO,
};

export const puede = (capacidad, tipoNegocio) => (CAPACIDADES[capacidad] || []).includes(familiaDe(tipoNegocio));

export { ETIQUETA_TIPO } from './tiposNegocio';
