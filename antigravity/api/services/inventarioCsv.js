// Importar y exportar productos con CSV (Excel). Sin base de datos: el análisis recibe los productos
// existentes y devuelve qué se haría con cada fila, para mostrar una vista previa antes de guardar.

const MAX_FILAS = 500;
const MAX_BYTES = 1024 * 1024;

// Columnas del archivo (cualquiera de estos nombres sirve; sin tildes ni mayúsculas).
const ALIAS = {
    nombre: ['nombre', 'producto', 'articulo', 'item'],
    sku: ['sku', 'codigo', 'referencia', 'cod'],
    precio: ['precio', 'precio venta', 'valor', 'pvp'],
    stock: ['stock', 'cantidad', 'existencias', 'inventario', 'unidades'],
    stock_minimo: ['stock minimo', 'minimo', 'stock min'],
    categoria: ['categoria', 'grupo', 'linea'],
    descripcion: ['descripcion', 'detalle'],
    controla_stock: ['controla stock', 'controlar inventario', 'controla inventario', 'controlar stock', 'controla'],
};

const sinTildes = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Convierte texto CSV en filas de celdas. Detecta ; o , como separador y respeta comillas y saltos de línea dentro de ellas. */
function parsearCsv(texto) {
    let t = String(texto ?? '').replace(/^﻿/, '');
    if (!t.trim()) return [];
    const primera = t.split(/\r?\n/, 1)[0];
    const sep = (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length && primera.includes(';') ? ';' : ',';
    const filas = [];
    let fila = [], celda = '', enComillas = false;
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (enComillas) {
            if (c === '"' && t[i + 1] === '"') { celda += '"'; i++; }
            else if (c === '"') enComillas = false;
            else celda += c;
        } else if (c === '"') enComillas = true;
        else if (c === sep) { fila.push(celda); celda = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && t[i + 1] === '\n') i++;
            fila.push(celda); celda = '';
            if (fila.some((x) => x.trim() !== '')) filas.push(fila);
            fila = [];
        } else celda += c;
    }
    fila.push(celda);
    if (fila.some((x) => x.trim() !== '')) filas.push(fila);
    return filas;
}

/** CSV con ; y BOM UTF-8: así Excel en español lo abre bien con tildes y columnas separadas. */
function generarCsv(filas) {
    const celda = (v) => {
        let s = v === null || v === undefined ? '' : String(v);
        // Evita que Excel interprete un texto como fórmula (=, +, -, @) al abrir el archivo.
        if (/^[=+\-@]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
        return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return `﻿${filas.map((f) => f.map(celda).join(';')).join('\r\n')}\r\n`;
}

function filasDeProductos(productos) {
    const encabezado = ['nombre', 'sku', 'precio', 'stock', 'stock_minimo', 'categoria', 'descripcion', 'controla_stock'];
    return [encabezado, ...productos.map((p) => [p.nombre, p.sku, p.precio, p.stock, p.stock_minimo, p.categoria, p.descripcion, p.controla_stock ? 'si' : 'no'])];
}

/** "12.500", "$ 12.500,50", "12500" → número; null si no es un número. */
function parsearNumero(v) {
    let s = String(v ?? '').replace(/[$\s]/g, '');
    if (!s) return null;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    const n = Number(s);
    return /^-?\d+(\.\d+)?$/.test(s) && Number.isFinite(n) ? n : null;
}

function parsearBooleano(v) {
    const s = sinTildes(v);
    if (!s) return null;
    if (['si', 's', '1', 'true', 'x', 'yes'].includes(s)) return true;
    if (['no', 'n', '0', 'false'].includes(s)) return false;
    return undefined; // valor raro
}

/**
 * Analiza el CSV y decide qué pasaría con cada fila.
 * `existentes`: productos del negocio [{id, nombre, sku, stock}].
 * Devuelve { filas: [{ numero, accion: 'crear'|'actualizar'|'error', datos, error }], resumen, error }.
 */
function analizarCsv(texto, existentes = []) {
    if (Buffer.byteLength(String(texto ?? ''), 'utf8') > MAX_BYTES) return { error: 'El archivo es demasiado grande (máx. 1 MB)' };
    const celdas = parsearCsv(texto);
    if (celdas.length < 2) return { error: 'El archivo debe tener una fila de títulos y al menos un producto' };
    if (celdas.length - 1 > MAX_FILAS) return { error: `Máximo ${MAX_FILAS} productos por archivo` };

    const columnas = {};
    celdas[0].forEach((titulo, i) => {
        const t = sinTildes(titulo);
        for (const [campo, nombres] of Object.entries(ALIAS)) {
            if (nombres.includes(t) && columnas[campo] === undefined) columnas[campo] = i;
        }
    });
    if (columnas.nombre === undefined) return { error: 'No encontré la columna "nombre". La primera fila debe tener los títulos (nombre, precio, stock...).' };

    const porSku = new Map(existentes.filter((p) => p.sku).map((p) => [String(p.sku).toLowerCase(), p]));
    const porNombre = new Map(existentes.map((p) => [sinTildes(p.nombre), p]));
    const vistosNombre = new Set();
    const vistosSku = new Set();
    const celdaDe = (fila, campo) => (columnas[campo] === undefined ? undefined : String(fila[columnas[campo]] ?? '').trim());

    const filas = celdas.slice(1).map((f, i) => {
        const numero = i + 2; // número de fila en Excel
        const err = (error) => ({ numero, accion: 'error', error, datos: null });

        const nombre = celdaDe(f, 'nombre');
        if (!nombre) return err('Falta el nombre');
        if (nombre.length > 150) return err('El nombre es demasiado largo (máx. 150)');
        const sku = celdaDe(f, 'sku') || null;
        if (sku && !/^[\w\-./]{1,40}$/.test(sku)) return err('El código (SKU) solo puede tener letras, números y - _ . / (máx. 40)');

        const claveNombre = sinTildes(nombre);
        if (vistosNombre.has(claveNombre)) return err('Este producto está repetido en el archivo');
        if (sku && vistosSku.has(sku.toLowerCase())) return err('Este código (SKU) está repetido en el archivo');

        const existente = (sku && porSku.get(sku.toLowerCase())) || porNombre.get(claveNombre) || null;
        const datos = { nombre, sku };

        const precioTxt = celdaDe(f, 'precio');
        if (precioTxt) {
            const precio = parsearNumero(precioTxt);
            if (precio === null || precio < 0 || precio > 99999999) return err(`El precio "${precioTxt}" no es válido`);
            datos.precio = precio;
        } else if (!existente) return err('Falta el precio');

        for (const [campo, etiqueta] of [['stock', 'El stock'], ['stock_minimo', 'El stock mínimo']]) {
            const txt = celdaDe(f, campo);
            if (txt) {
                const n = parsearNumero(txt);
                if (n === null || !Number.isInteger(n) || n < 0 || n > 1000000) return err(`${etiqueta} "${txt}" debe ser un número entero de 0 o más`);
                datos[campo] = n;
            }
        }
        const cat = celdaDe(f, 'categoria');
        if (cat) datos.categoria = cat.slice(0, 80);
        const desc = celdaDe(f, 'descripcion');
        if (desc) datos.descripcion = desc.slice(0, 500);

        const ctl = parsearBooleano(celdaDe(f, 'controla_stock'));
        if (ctl === undefined) return err('"controla_stock" debe ser si o no');
        if (ctl !== null) datos.controla_stock = ctl;
        // Si el archivo trae stock y no dice nada más, se entiende que quieren controlarlo (solo en productos nuevos).
        else if (!existente && datos.stock !== undefined) datos.controla_stock = true;

        vistosNombre.add(claveNombre);
        if (sku) vistosSku.add(sku.toLowerCase());
        return existente ? { numero, accion: 'actualizar', producto_id: existente.id, stock_actual: Number(existente.stock), datos } : { numero, accion: 'crear', datos };
    });

    const cuenta = (a) => filas.filter((f) => f.accion === a).length;
    return { filas, resumen: { crear: cuenta('crear'), actualizar: cuenta('actualizar'), errores: cuenta('error'), total: filas.length } };
}

module.exports = { MAX_FILAS, MAX_BYTES, parsearCsv, generarCsv, filasDeProductos, parsearNumero, analizarCsv };
