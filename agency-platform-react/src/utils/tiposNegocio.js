// Catálogo de tipos de negocio para elegir (en vez de escribirlos). Cada tipo pertenece a una
// "familia" (los 7 tipos originales): la familia decide qué herramientas ve el negocio.
// Mantener sincronizado con antigravity/api/services/tiposNegocio.js.
export const GRUPOS_TIPO = [
  { id: 'comida', label: 'Comida y bebida', familia: 'restaurante', tipos: [
    ['restaurante', 'Restaurante'], ['comidas_rapidas', 'Comidas rápidas'], ['pizzeria', 'Pizzería'],
    ['asadero', 'Asadero / Parrilla'], ['panaderia', 'Panadería'], ['pasteleria', 'Pastelería y repostería'],
    ['cafeteria', 'Cafetería'], ['heladeria', 'Heladería'], ['granizados', 'Granizados y raspados'],
    ['jugos', 'Jugos y batidos'], ['bar', 'Bar y discoteca'],
  ] },
  { id: 'tiendas', label: 'Tiendas y productos', familia: 'retail', tipos: [
    ['retail', 'Tienda'], ['ropa', 'Ropa y moda'], ['calzado', 'Calzado'], ['tecnologia', 'Tecnología y celulares'],
    ['ferreteria', 'Ferretería'], ['miscelanea', 'Miscelánea / Supermercado'], ['floristeria', 'Floristería y regalos'],
    ['papeleria', 'Papelería'], ['mascotas', 'Tienda de mascotas'], ['cosmeticos', 'Cosméticos y perfumería'],
    ['licores', 'Licores'], ['joyeria', 'Joyería y accesorios'], ['hogar', 'Hogar y muebles'], ['jugueteria', 'Juguetes'],
    ['farmacia', 'Farmacia'],
  ] },
  { id: 'servicios', label: 'Servicios', familia: 'servicios', tipos: [
    ['servicios', 'Servicios'], ['belleza', 'Salón de belleza'], ['barberia', 'Barbería'], ['spa', 'Spa y estética'],
    ['lavanderia', 'Lavandería'], ['taller', 'Taller mecánico'], ['fotografia', 'Fotografía y eventos'],
    ['transporte', 'Transporte y mudanzas'], ['limpieza', 'Limpieza y mantenimiento'], ['gimnasio', 'Gimnasio y deportes'],
  ] },
  { id: 'salud', label: 'Salud', familia: 'salud', tipos: [
    ['salud', 'Salud'], ['odontologia', 'Odontología'], ['veterinaria', 'Veterinaria'], ['optica', 'Óptica'],
    ['psicologia', 'Psicología y terapias'],
  ] },
  { id: 'inmobiliaria', label: 'Inmobiliaria', familia: 'inmobiliaria', tipos: [['inmobiliaria', 'Inmobiliaria']] },
  { id: 'educacion', label: 'Educación', familia: 'educacion', tipos: [
    ['educacion', 'Educación'], ['idiomas', 'Idiomas'], ['academia', 'Academia y cursos'],
  ] },
  { id: 'otro', label: 'Otro', familia: 'otro', tipos: [['otro', 'Otro']] },
];

export const ETIQUETA_TIPO = Object.fromEntries(GRUPOS_TIPO.flatMap((g) => g.tipos));

const FAMILIA = Object.fromEntries(GRUPOS_TIPO.flatMap((g) => g.tipos.map(([v]) => [v, g.familia])));

/** Familia (restaurante, retail, servicios…) de un tipo; null si es vacío o desconocido. */
export const familiaDe = (tipo) => FAMILIA[tipo] || null;
