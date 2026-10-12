const db = require('../../db/config');

// Catálogo con fotos: si el cliente o el bot nombran un producto que tiene
// `imagen_url`, se le envía la foto con su precio (máx. 3 por respuesta y sin
// repetir el mismo producto en 30 minutos).

const MAX_FOTOS = 3;

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Puro: de la lista de productos, cuáles se mencionan en los textos.
function productosMencionados(productos, textos) {
    const t = normalizar(textos.join(' \n '));
    return productos
        .filter((p) => p.imagen_url && /^https?:\/\//i.test(p.imagen_url))
        .filter((p) => {
            const nombre = normalizar(p.nombre).trim();
            return nombre.length >= 3 && t.includes(nombre);
        })
        .slice(0, MAX_FOTOS);
}

async function enviarFotosProductos({ sock, jid, negocioId, numero, textos }) {
    try {
        const [productos] = await db.execute(
            'SELECT id, nombre, precio, imagen_url FROM productos WHERE negocio_id = ? AND activo = 1 AND imagen_url IS NOT NULL AND imagen_url <> \'\'',
            [negocioId]
        );
        if (productos.length === 0) return;

        for (const p of productosMencionados(productos, textos)) {
            const [recientes] = await db.execute(
                `SELECT id FROM mensajes WHERE negocio_id = ? AND numero_cliente = ? AND agente_proceso = 'foto'
                 AND contenido LIKE ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE) LIMIT 1`,
                [negocioId, `+${numero}`, `%${p.nombre}%`]
            );
            if (recientes.length > 0) continue;

            const caption = `${p.nombre} — $${Number(p.precio).toLocaleString('es-CO')}`;
            await sock.sendMessage(jid, { image: { url: p.imagen_url }, caption });
            await db.execute(
                `INSERT INTO mensajes (negocio_id, numero_cliente, tipo, contenido, agente_proceso, intencion_detectada)
                 VALUES (?, ?, 'salida', ?, 'foto', 'catalogo')`,
                [negocioId, `+${numero}`, caption]
            );
        }
    } catch (e) {
        // Una foto que falla nunca debe tumbar la conversación.
        console.error('[Fotos] No se pudo enviar la foto del producto:', e.message);
    }
}

module.exports = { productosMencionados, enviarFotosProductos };
