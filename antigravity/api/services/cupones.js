const db = require('../../db/config');

// Cupones de descuento. La lógica de validar/calcular es pura (se prueba sin
// base de datos); la búsqueda y el "uso" del cupón sí tocan la tabla `cupones`
// (db/migrate_v3_funciones.js). Todo es defensivo: si la tabla aún no existe o
// algo falla, el pedido se crea igual, sin descuento.

const quitarAcentos = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function normalizarCodigo(c) {
    return quitarAcentos(c).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

// ¿Aplica este cupón a una compra de `subtotal`? hoy = Date (para poder probar).
function validarCupon(cupon, subtotal, hoy = new Date()) {
    if (!cupon || !cupon.activo) return { ok: false, motivo: 'inactivo' };
    if (cupon.vence_el) {
        // 'YYYY-MM-DD' (o el Date que devuelve mysql2 para una columna DATE): vale
        // hasta el final de ese día en hora local. new Date('YYYY-MM-DD') sería
        // medianoche UTC y vencería el cupón un día antes en Colombia.
        let y, m, d;
        if (cupon.vence_el instanceof Date) {
            y = cupon.vence_el.getFullYear(); m = cupon.vence_el.getMonth() + 1; d = cupon.vence_el.getDate();
        } else {
            [y, m, d] = String(cupon.vence_el).slice(0, 10).split('-').map(Number);
        }
        if (hoy > new Date(y, m - 1, d, 23, 59, 59, 999)) return { ok: false, motivo: 'vencido' };
    }
    if (cupon.usos_max != null && cupon.usos >= cupon.usos_max) return { ok: false, motivo: 'agotado' };
    if (Number(cupon.minimo_compra) > 0 && subtotal < Number(cupon.minimo_compra)) {
        return { ok: false, motivo: 'minimo', minimo: Number(cupon.minimo_compra) };
    }
    return { ok: true };
}

// Nunca descuenta más que el subtotal (el total no puede quedar negativo).
function calcularDescuento(cupon, subtotal) {
    const valor = Number(cupon.valor);
    const bruto = cupon.tipo === 'porcentaje' ? (subtotal * Math.min(valor, 100)) / 100 : valor;
    return Math.max(0, Math.min(subtotal, Math.round(bruto)));
}

// Busca si algún cupón activo del negocio aparece escrito en los textos del cliente.
async function buscarEnTextos(negocioId, textos) {
    try {
        const [cupones] = await db.execute('SELECT * FROM cupones WHERE negocio_id = ? AND activo = 1', [negocioId]);
        if (cupones.length === 0) return null;
        const t = ` ${quitarAcentos(textos.join(' \n ')).toUpperCase()} `;
        for (const c of cupones) {
            const cod = normalizarCodigo(c.codigo);
            if (!cod) continue;
            const re = new RegExp(`(^|[^A-Z0-9_-])${cod.replace(/[-_]/g, '[-_]?')}($|[^A-Z0-9_-])`);
            if (re.test(t)) return c;
        }
        return null;
    } catch (e) {
        return null;
    }
}

// Reclama un uso de forma atómica (dos pedidos a la vez no pasan el tope).
async function reclamarUso(cuponId) {
    try {
        const [r] = await db.execute(
            'UPDATE cupones SET usos = usos + 1 WHERE id = ? AND activo = 1 AND (usos_max IS NULL OR usos < usos_max)',
            [cuponId]
        );
        return r.affectedRows > 0;
    } catch (e) {
        return false;
    }
}

async function liberarUso(cuponId) {
    try { await db.execute('UPDATE cupones SET usos = GREATEST(usos - 1, 0) WHERE id = ?', [cuponId]); } catch (e) { /* nada */ }
}

module.exports = { normalizarCodigo, validarCupon, calcularDescuento, buscarEnTextos, reclamarUso, liberarUso };
