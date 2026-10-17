// Catálogo de tipos de negocio que se pueden elegir. Cada tipo pertenece a una "familia" (los 7
// valores originales del ENUM): la familia decide qué herramientas ve el negocio y qué plantilla
// de ejemplo se precarga. Mantener sincronizado con agency-platform-react/src/utils/tiposNegocio.js.
const GRUPOS = {
    comida: [
        ['restaurante', 'Restaurante'], ['comidas_rapidas', 'Comidas rápidas'], ['pizzeria', 'Pizzería'],
        ['asadero', 'Asadero / Parrilla'], ['panaderia', 'Panadería'], ['pasteleria', 'Pastelería y repostería'],
        ['cafeteria', 'Cafetería'], ['heladeria', 'Heladería'], ['granizados', 'Granizados y raspados'],
        ['jugos', 'Jugos y batidos'], ['bar', 'Bar y discoteca'],
    ],
    tiendas: [
        ['retail', 'Tienda'], ['ropa', 'Ropa y moda'], ['calzado', 'Calzado'], ['tecnologia', 'Tecnología y celulares'],
        ['ferreteria', 'Ferretería'], ['miscelanea', 'Miscelánea / Supermercado'], ['floristeria', 'Floristería y regalos'],
        ['papeleria', 'Papelería'], ['mascotas', 'Tienda de mascotas'], ['cosmeticos', 'Cosméticos y perfumería'],
        ['licores', 'Licores'], ['joyeria', 'Joyería y accesorios'], ['hogar', 'Hogar y muebles'], ['jugueteria', 'Juguetes'],
        ['farmacia', 'Farmacia'],
    ],
    servicios: [
        ['servicios', 'Servicios'], ['belleza', 'Salón de belleza'], ['barberia', 'Barbería'], ['spa', 'Spa y estética'],
        ['lavanderia', 'Lavandería'], ['taller', 'Taller mecánico'], ['fotografia', 'Fotografía y eventos'],
        ['transporte', 'Transporte y mudanzas'], ['limpieza', 'Limpieza y mantenimiento'], ['gimnasio', 'Gimnasio y deportes'],
    ],
    salud: [
        ['salud', 'Salud'], ['odontologia', 'Odontología'], ['veterinaria', 'Veterinaria'], ['optica', 'Óptica'],
        ['psicologia', 'Psicología y terapias'],
    ],
    inmobiliaria: [['inmobiliaria', 'Inmobiliaria']],
    educacion: [['educacion', 'Educación'], ['idiomas', 'Idiomas'], ['academia', 'Academia y cursos']],
    otro: [['otro', 'Otro']],
};

// grupo -> familia (valor del ENUM original)
const FAMILIA_DE_GRUPO = {
    comida: 'restaurante', tiendas: 'retail', servicios: 'servicios', salud: 'salud',
    inmobiliaria: 'inmobiliaria', educacion: 'educacion', otro: 'otro',
};

const FAMILIA = {};
for (const [grupo, tipos] of Object.entries(GRUPOS)) {
    for (const [valor] of tipos) FAMILIA[valor] = FAMILIA_DE_GRUPO[grupo];
}

const TIPOS_NEGOCIO = Object.keys(FAMILIA);

const esTipoValido = (t) => typeof t === 'string' && Object.prototype.hasOwnProperty.call(FAMILIA, t);
const familiaDe = (t) => (esTipoValido(t) ? FAMILIA[t] : null);

module.exports = { TIPOS_NEGOCIO, esTipoValido, familiaDe };
