// Qué herramientas ve cada tipo de negocio. Una sola tabla: para dar o quitar una herramienta a un
// tipo se edita aquí y el menú, las rutas y los atajos se ajustan solos.
//
// Regla: el núcleo (pedidos, conversaciones, productos, clientes, campañas, automatizaciones,
// suscripción) lo ven TODOS. Aquí solo van las herramientas que tienen sentido para un giro concreto.
// Los tipos son los del registro (ENUM tipo_negocio). Un tipo desconocido o vacío recibe el núcleo.
export const TIPOS_CON_DOMICILIO = ['restaurante', 'retail'];

export const CAPACIDADES = {
  // Pantalla grande para cocina: pedidos pagados por preparar con botón gigante "Listo"
  cocina: ['restaurante'],
  // Domicilios / restaurantes / mapa de repartidores
  domicilios: TIPOS_CON_DOMICILIO,
};

export const puede = (capacidad, tipoNegocio) => (CAPACIDADES[capacidad] || []).includes(tipoNegocio);

export const ETIQUETA_TIPO = {
  restaurante: 'Restaurante',
  retail: 'Tienda',
  servicios: 'Servicios',
  salud: 'Salud',
  inmobiliaria: 'Inmobiliaria',
  educacion: 'Educación',
  otro: 'Otro',
};
