// Validación de los datos de un cliente que el dueño crea a mano (POST /api/clientes).
// Los clientes normales se crean solos cuando escriben por WhatsApp; esto es para agregar a alguien con anticipación.

/**
 * Deja el WhatsApp como "+<código><número>". Acepta "300 123 4567", "+57 300 123 4567", "573001234567".
 * Un número colombiano de 10 dígitos que empieza por 3 se completa con el 57. Devuelve null si no parece un teléfono.
 */
function normalizarWhatsapp(valor) {
    if (typeof valor !== 'string') return null;
    let digitos = valor.replace(/[^\d]/g, '');
    if (/^3\d{9}$/.test(digitos)) digitos = `57${digitos}`;
    if (digitos.length < 11 || digitos.length > 15) return null;
    return `+${digitos}`;
}

/** Devuelve { valores: { nombre, whatsapp, email } } o { error }. */
function sanearNuevoCliente(body) {
    const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : '';
    if (nombre.length < 2) return { error: 'Escribe el nombre del cliente' };
    if (nombre.length > 100) return { error: 'El nombre es demasiado largo (máx. 100)' };

    const whatsapp = normalizarWhatsapp(body?.whatsapp);
    if (!whatsapp) return { error: 'El WhatsApp no es válido. Ejemplo: 300 123 4567' };

    let email = null;
    if (body?.email !== undefined && body.email !== null && String(body.email).trim() !== '') {
        email = String(body.email).trim().toLowerCase();
        if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'El correo no es válido' };
    }
    return { valores: { nombre, whatsapp, email } };
}

module.exports = { normalizarWhatsapp, sanearNuevoCliente };
