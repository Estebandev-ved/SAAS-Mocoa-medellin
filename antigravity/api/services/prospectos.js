// Utilidades puras del registro de prospectos (sin base de datos, fáciles de probar).

const ESTADOS = ['nuevo', 'contactado', 'video_enviado', 'respondio', 'demo', 'cliente', 'descartado'];

// Deja solo dígitos con indicativo de Colombia. Acepta "300 123 4567", "+57 300 123 4567",
// "(57) 3001234567". Devuelve null si no parece un celular válido (para no guardar basura
// que luego rompa el enlace de WhatsApp).
function normalizarWhatsapp(entrada) {
    if (entrada === null || entrada === undefined) return null;
    let d = String(entrada).replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 10 && d.startsWith('3')) return `57${d}`;
    if (d.length === 12 && d.startsWith('573')) return d;
    // Otros países (internacional): 8 a 15 dígitos, tal cual.
    if (d.length >= 8 && d.length <= 15 && !d.startsWith('0')) return d;
    return null;
}

const URL_RE = /^https?:\/\/[^\s]+$/i;
const esUrl = (v) => typeof v === 'string' && URL_RE.test(v.trim());

// Reemplaza {nombre}, {negocio}, {video} en la plantilla del mensaje. Lo que falte queda vacío
// (no deja "{video}" a la vista del prospecto).
function armarMensaje(plantilla, prospecto) {
    const valores = {
        nombre: (prospecto.contacto || '').trim().split(/\s+/)[0] || '',
        negocio: (prospecto.nombre_negocio || '').trim(),
        video: (prospecto.video_url || '').trim(),
    };
    return String(plantilla || '')
        .replace(/\{(nombre|negocio|video)\}/g, (_, k) => valores[k])
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/ +([,.!?])/g, '$1')
        .trim();
}

function enlaceWhatsapp(whatsapp, mensaje) {
    const num = normalizarWhatsapp(whatsapp);
    if (!num) return null;
    return `https://wa.me/${num}?text=${encodeURIComponent(mensaje || '')}`;
}

// Valida y limpia el cuerpo de crear/editar. Devuelve { error } o { datos } con solo campos permitidos.
function validarProspecto(body, { parcial = false } = {}) {
    const b = body || {};
    const datos = {};
    const texto = (k, max) => {
        if (b[k] === undefined) return;
        const v = b[k] === null ? null : String(b[k]).trim();
        datos[k] = v === '' ? null : v && v.slice(0, max);
    };

    texto('nombre_negocio', 150);
    texto('contacto', 120);
    texto('email', 150);
    texto('ciudad', 80);
    texto('tipo_negocio', 80);
    texto('fuente', 40);
    texto('redes_url', 255);
    texto('video_notas', 255);
    texto('notas', 5000);

    if (!parcial && !datos.nombre_negocio) return { error: 'El nombre del negocio es obligatorio' };
    if (parcial && 'nombre_negocio' in datos && !datos.nombre_negocio) return { error: 'El nombre del negocio no puede quedar vacío' };

    if (b.whatsapp !== undefined) {
        if (b.whatsapp === null || String(b.whatsapp).trim() === '') datos.whatsapp = null;
        else {
            const n = normalizarWhatsapp(b.whatsapp);
            if (!n) return { error: 'El WhatsApp no parece un número válido (ej. 300 123 4567)' };
            datos.whatsapp = n;
        }
    }
    if (b.video_url !== undefined) {
        if (b.video_url === null || String(b.video_url).trim() === '') datos.video_url = null;
        else if (!esUrl(b.video_url) || String(b.video_url).length > 500) return { error: 'El enlace del video debe empezar por http:// o https://' };
        else datos.video_url = String(b.video_url).trim();
    }
    if (datos.redes_url && !esUrl(datos.redes_url)) return { error: 'El enlace de redes debe empezar por http:// o https://' };
    if (datos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) return { error: 'El correo no es válido' };

    if (b.estado !== undefined) {
        if (!ESTADOS.includes(b.estado)) return { error: 'Estado inválido' };
        datos.estado = b.estado;
    }
    if (b.proximo_seguimiento !== undefined) {
        if (b.proximo_seguimiento === null || b.proximo_seguimiento === '') datos.proximo_seguimiento = null;
        else if (/^\d{4}-\d{2}-\d{2}$/.test(String(b.proximo_seguimiento))) datos.proximo_seguimiento = String(b.proximo_seguimiento);
        else return { error: 'La fecha de seguimiento debe ser AAAA-MM-DD' };
    }
    return { datos };
}

module.exports = { ESTADOS, normalizarWhatsapp, esUrl, armarMensaje, enlaceWhatsapp, validarProspecto };
