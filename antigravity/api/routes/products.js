const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { checkProductLimit } = require('../middleware/tenant');
const { checkLimit } = require('../../config/planConfig');
const inventario = require('../services/inventario');
const csv = require('../services/inventarioCsv');

// Router canónico para /api/productos. Reemplaza la implementación duplicada
// que vivía en routes/all.js (pool de MySQL propio) y el archivo
// routes/products.js, que existía pero nunca se montaba en index.js.
router.use(verificarAuth);

// Responde con un mensaje claro los errores del inventario (stock insuficiente, cantidad inválida...).
// Devuelve false si el error no es del inventario (el llamador sigue con su manejo normal).
function responderErrorInventario(res, e) {
    if (!(e instanceof inventario.ErrorInventario)) return false;
    const estado = e.codigo === 'PRODUCTO_NO_ENCONTRADO' ? 404 : 400;
    const mensaje = e.codigo === 'STOCK_INSUFICIENTE' ? `Stock insuficiente: solo hay ${e.detalle.disponible}` : e.message;
    res.status(estado).json({ error: mensaje, codigo: e.codigo, ...e.detalle });
    return true;
}

// Descarga todos los productos como CSV (se abre en Excel). Va antes de /:id.
router.get('/exportar', async (req, res) => {
    try {
        const [productos] = await db.execute('SELECT * FROM productos WHERE negocio_id = ? AND activo = 1 ORDER BY nombre', [req.negocioId]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="productos.csv"');
        res.send(csv.generarCsv(csv.filasDeProductos(productos)));
    } catch (error) {
        console.error('[Productos] Error exportando:', error.message);
        res.status(500).json({ error: 'Error al exportar los productos' });
    }
});

// Importa productos desde un CSV. Sin `aplicar: true` solo muestra qué pasaría con cada fila (vista previa);
// con `aplicar: true` lo guarda. Las filas con error se saltan y el resto se aplica.
router.post('/importar', async (req, res) => {
    try {
        const texto = typeof req.body?.csv === 'string' ? req.body.csv : '';
        const [existentes] = await db.execute('SELECT id, nombre, sku, stock FROM productos WHERE negocio_id = ? AND activo = 1', [req.negocioId]);
        const analisis = csv.analizarCsv(texto, existentes);
        if (analisis.error) return res.status(400).json({ error: analisis.error });

        // Límite del plan: solo cuentan los productos nuevos.
        const [conteo] = await db.execute('SELECT COUNT(*) AS total FROM productos WHERE negocio_id = ?', [req.negocioId]);
        const limite = checkLimit(req.negocio?.plan || 'starter', 'maxProducts', 0).limit;
        if (limite !== -1 && Number(conteo[0].total) + analisis.resumen.crear > limite) {
            return res.status(403).json({ error: `Con este archivo pasarías el límite de ${limite} productos de tu plan.`, codigo: 'LIMITE_PRODUCTOS', limite });
        }
        if (req.body?.aplicar !== true) return res.json({ aplicado: false, ...analisis });

        const resultado = { creados: 0, actualizados: 0, errores: [] };
        for (const f of analisis.filas) {
            if (f.accion === 'error') { resultado.errores.push({ numero: f.numero, error: f.error }); continue; }
            try {
                let hecho = null;
                await inventario.conTransaccion(db, async (con) => {
                    const d = f.datos;
                    if (f.accion === 'crear') {
                        const [r] = await con.execute(
                            `INSERT INTO productos (negocio_id, nombre, sku, descripcion, precio, stock, activo, categoria, controla_stock, stock_minimo)
                             VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`,
                            [req.negocioId, d.nombre, d.sku, d.descripcion || null, d.precio, d.categoria || null, d.controla_stock ? 1 : 0, d.stock_minimo ?? null]
                        );
                        if (d.stock > 0) {
                            await inventario.registrarMovimiento(con, { negocioId: req.negocioId, productoId: r.insertId, tipo: 'entrada', delta: d.stock, motivo: 'Inventario inicial (importación)' });
                        }
                        hecho = 'creados';
                    } else {
                        const sets = [];
                        const vals = [];
                        for (const campo of ['precio', 'sku', 'categoria', 'descripcion', 'stock_minimo']) {
                            if (d[campo] !== undefined && d[campo] !== null) { sets.push(`${campo} = ?`); vals.push(d[campo]); }
                        }
                        if (d.controla_stock !== undefined) { sets.push('controla_stock = ?'); vals.push(d.controla_stock ? 1 : 0); }
                        if (sets.length) await con.execute(`UPDATE productos SET ${sets.join(', ')} WHERE id = ? AND negocio_id = ?`, [...vals, f.producto_id, req.negocioId]);
                        if (d.stock !== undefined && d.stock !== f.stock_actual) {
                            await inventario.registrarMovimiento(con, { negocioId: req.negocioId, productoId: f.producto_id, tipo: 'ajuste', delta: d.stock - f.stock_actual, motivo: 'Ajuste por importación' });
                        }
                        hecho = 'actualizados';
                    }
                });
                resultado[hecho]++; // solo cuenta si la transacción de la fila se confirmó
            } catch (e) {
                resultado.errores.push({ numero: f.numero, error: e.code === 'ER_DUP_ENTRY' ? 'Ya existe otro producto con ese código (SKU)' : (e.message || 'No se pudo guardar') });
            }
        }
        res.json({ aplicado: true, ...resultado });
    } catch (error) {
        console.error('[Productos] Error importando:', error.message);
        res.status(500).json({ error: 'Error al importar los productos' });
    }
});

// Historial de movimientos de un producto (los más recientes primero).
router.get('/:id/movimientos', async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
        const [dueno] = await db.execute('SELECT id, nombre, stock FROM productos WHERE id = ? AND negocio_id = ?', [req.params.id, req.negocioId]);
        if (dueno.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        const [movimientos] = await db.execute(
            `SELECT id, tipo, cantidad, stock_resultante, motivo, referencia_tipo, referencia_id, created_at
             FROM inventario_movimientos WHERE negocio_id = ? AND producto_id = ? ORDER BY id DESC LIMIT ?`,
            [req.negocioId, req.params.id, limit]
        );
        res.json({ producto: dueno[0], movimientos });
    } catch (error) {
        console.error('[Productos] Error en movimientos:', error.message);
        res.status(500).json({ error: 'Error al obtener el historial' });
    }
});

router.get('/', async (req, res) => {
    try {
        const { activo, buscar, restaurante_id, page = 1, limit = 50 } = req.query;

        let whereClause = 'WHERE negocio_id = ?';
        const params = [req.negocioId];

        if (activo !== undefined) {
            whereClause += ' AND activo = ?';
            params.push(activo === 'true');
        }
        if (restaurante_id !== undefined) {
            whereClause += restaurante_id === '' || restaurante_id === 'sin_restaurante'
                ? ' AND restaurante_id IS NULL'
                : ' AND restaurante_id = ?';
            if (!(restaurante_id === '' || restaurante_id === 'sin_restaurante')) params.push(restaurante_id);
        }
        if (buscar) {
            whereClause += ' AND (nombre LIKE ? OR descripcion LIKE ?)';
            params.push(`%${buscar}%`, `%${buscar}%`);
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const [productos] = await db.execute(
            `SELECT * FROM productos ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({ productos });
    } catch (error) {
        console.error('[Productos] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [productos] = await db.execute(
            'SELECT * FROM productos WHERE id = ? AND negocio_id = ?',
            [id, req.negocioId]
        );

        if (productos.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ producto: productos[0] });
    } catch (error) {
        console.error('[Productos] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener producto' });
    }
});

// Sube una foto de la carta/menú y devuelve los productos que la IA logró leer
// — NO los guarda todavía. El dueño los revisa y corrige en pantalla (precios
// o nombres mal leídos son comunes con fotos borrosas) y confirma con
// POST /bulk. Body: { imagen: "<base64 sin encabezado data:image/...>" }.
router.post('/importar-foto', async (req, res) => {
    try {
        const { imagen } = req.body;
        if (!imagen || imagen.length < 1000) {
            return res.status(400).json({ error: 'Envía una foto clara de la carta' });
        }

        const { extraerCatalogoDeImagen } = require('../../instance-manager/agents/gemini');
        const resultado = await extraerCatalogoDeImagen(imagen);

        if (resultado.items.length === 0) {
            return res.status(422).json({ error: resultado.error || 'No se encontraron productos en la imagen' });
        }

        res.json({ items: resultado.items });
    } catch (error) {
        console.error('[Productos] Error importando foto:', error.message);
        res.status(500).json({ error: 'Error al leer la imagen' });
    }
});

// Guarda de una vez los productos que el dueño confirmó tras importar la foto
// (o cualquier otra lista que arme desde el frontend). Respeta el mismo
// límite de plan que la creación individual.
router.post('/bulk', checkProductLimit, async (req, res) => {
    try {
        const { productos, restaurante_id } = req.body;
        if (!Array.isArray(productos) || productos.length === 0) {
            return res.status(400).json({ error: 'Envía al menos un producto' });
        }
        if (productos.length > 60) {
            return res.status(400).json({ error: 'Máximo 60 productos por importación' });
        }

        // Si viene un restaurante, hay que confirmar que es del mismo negocio
        // antes de amarrar productos a él (evita que un id ajeno se cuele).
        let restauranteIdValido = null;
        if (restaurante_id) {
            const [rest] = await db.execute(
                'SELECT id FROM restaurantes WHERE id = ? AND negocio_id = ?',
                [restaurante_id, req.negocioId]
            );
            if (rest.length === 0) {
                return res.status(400).json({ error: 'Restaurante inválido' });
            }
            restauranteIdValido = rest[0].id;
        }

        const validos = productos
            .map((p) => ({
                nombre: (p?.nombre || '').toString().trim().slice(0, 150),
                descripcion: (p?.descripcion || '').toString().trim().slice(0, 500) || null,
                precio: Number(p?.precio),
                categoria: (p?.categoria || '').toString().trim().slice(0, 80) || null,
            }))
            .filter((p) => p.nombre && Number.isFinite(p.precio) && p.precio > 0);

        if (validos.length === 0) {
            return res.status(400).json({ error: 'Ningún producto tiene nombre y precio válidos' });
        }

        const values = [];
        const placeholders = validos.map((p) => {
            values.push(req.negocioId, p.nombre, p.descripcion, p.precio, 0, true, null, p.categoria, restauranteIdValido);
            return '(?, ?, ?, ?, ?, ?, ?, ?, ?)';
        }).join(', ');

        await db.execute(
            `INSERT INTO productos (negocio_id, nombre, descripcion, precio, stock, activo, imagen_url, categoria, restaurante_id)
             VALUES ${placeholders}`,
            values
        );

        res.status(201).json({ mensaje: `${validos.length} productos creados`, creados: validos.length });
    } catch (error) {
        console.error('[Productos] Error creando en lote:', error.message);
        res.status(500).json({ error: 'Error al guardar los productos' });
    }
});

router.post('/', checkProductLimit, async (req, res) => {
    try {
        const { nombre, descripcion, precio, stock, activo, imagen_url, categoria, restaurante_id } = req.body;

        if (!nombre || !precio) {
            return res.status(400).json({ error: 'Nombre y precio son requeridos' });
        }
        const campos = inventario.sanearCamposInventario(req.body);
        if (campos.error) return res.status(400).json({ error: campos.error });
        const stk = inventario.sanearStock(stock);
        if (stk.error) return res.status(400).json({ error: stk.error });

        let restauranteIdValido = null;
        if (restaurante_id) {
            const [rest] = await db.execute(
                'SELECT id FROM restaurantes WHERE id = ? AND negocio_id = ?',
                [restaurante_id, req.negocioId]
            );
            if (rest.length === 0) {
                return res.status(400).json({ error: 'Restaurante inválido' });
            }
            restauranteIdValido = rest[0].id;
        }

        // Las columnas de inventario solo se incluyen si vinieron (así sigue funcionando con formularios viejos).
        const extra = Object.entries(campos.valores);
        const [result] = await db.execute(
            `INSERT INTO productos (negocio_id, nombre, descripcion, precio, stock, activo, imagen_url, categoria, restaurante_id${extra.map(([k]) => `, ${k}`).join('')})
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?${extra.map(() => ', ?').join('')})`,
            [req.negocioId, nombre, descripcion || null, precio, stk.valor || 0, activo !== false, imagen_url || null, categoria || null, restauranteIdValido, ...extra.map(([, v]) => v)]
        );
        // Con inventario controlado, el stock inicial queda en el historial.
        if (campos.valores.controla_stock && stk.valor > 0) {
            await db.execute(
                `INSERT INTO inventario_movimientos (negocio_id, producto_id, tipo, cantidad, stock_resultante, motivo, referencia_tipo, referencia_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.negocioId, result.insertId, 'entrada', stk.valor, stk.valor, 'Inventario inicial', null, null]
            );
        }

        const [nuevoProducto] = await db.execute('SELECT * FROM productos WHERE id = ?', [result.insertId]);

        res.status(201).json({ mensaje: 'Producto creado', id: result.insertId, producto: nuevoProducto[0] });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya tienes un producto con ese código (SKU)' });
        console.error('[Productos] Error:', error.message);
        res.status(500).json({ error: 'Error al crear producto' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, precio, stock, activo, imagen_url, categoria, restaurante_id } = req.body;

        const campos = inventario.sanearCamposInventario(req.body);
        if (campos.error) return res.status(400).json({ error: campos.error });
        const stk = inventario.sanearStock(stock);
        if (stk.error) return res.status(400).json({ error: stk.error });

        const updates = [];
        const params = [];
        for (const [k, v] of Object.entries(campos.valores)) { updates.push(`${k} = ?`); params.push(v); }
        if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre); }
        if (descripcion !== undefined) { updates.push('descripcion = ?'); params.push(descripcion); }
        if (precio !== undefined) { updates.push('precio = ?'); params.push(precio); }
        // El stock NO se pisa con un UPDATE: se registra un movimiento de ajuste (más abajo) para que quede historial.
        if (activo !== undefined) { updates.push('activo = ?'); params.push(activo); }
        if (imagen_url !== undefined) { updates.push('imagen_url = ?'); params.push(imagen_url); }
        if (categoria !== undefined) { updates.push('categoria = ?'); params.push(categoria || null); }
        if (restaurante_id !== undefined) {
            if (restaurante_id === null || restaurante_id === '') {
                updates.push('restaurante_id = NULL');
            } else {
                const [rest] = await db.execute(
                    'SELECT id FROM restaurantes WHERE id = ? AND negocio_id = ?',
                    [restaurante_id, req.negocioId]
                );
                if (rest.length === 0) {
                    return res.status(400).json({ error: 'Restaurante inválido' });
                }
                updates.push('restaurante_id = ?');
                params.push(rest[0].id);
            }
        }

        if (updates.length === 0 && stk.valor === undefined) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        if (updates.length > 0) {
            params.push(id, req.negocioId);
            const [result] = await db.execute(
                `UPDATE productos SET ${updates.join(', ')} WHERE id = ? AND negocio_id = ?`,
                params
            );
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Producto no encontrado' });
            }
        }

        // Cambio de stock desde el formulario: se guarda la diferencia como un ajuste con historial.
        if (stk.valor !== undefined) {
            await inventario.conTransaccion(db, async (con) => {
                const [filas] = await con.execute('SELECT stock FROM productos WHERE id = ? AND negocio_id = ? FOR UPDATE', [id, req.negocioId]);
                if (filas.length === 0) throw new inventario.ErrorInventario('PRODUCTO_NO_ENCONTRADO', 'Producto no encontrado');
                const diferencia = stk.valor - Number(filas[0].stock);
                if (diferencia !== 0) {
                    await inventario.registrarMovimiento(con, { negocioId: req.negocioId, productoId: Number(id), tipo: 'ajuste', delta: diferencia, motivo: 'Corrección manual' });
                }
            });
        }

        const [productoActualizado] = await db.execute('SELECT * FROM productos WHERE id = ?', [id]);

        res.json({ mensaje: 'Producto actualizado', producto: productoActualizado[0] });
    } catch (error) {
        if (responderErrorInventario(res, error)) return;
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya tienes un producto con ese código (SKU)' });
        console.error('[Productos] Error:', error.message);
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
});

router.patch('/:id/stock', async (req, res) => {
    try {
        const { id } = req.params;
        const { operacion, cantidad } = req.body;

        if (!operacion || !cantidad) {
            return res.status(400).json({ error: 'Operación y cantidad son requeridos' });
        }
        if (!['agregar', 'restar'].includes(operacion)) {
            return res.status(400).json({ error: 'Operación debe ser agregar o restar' });
        }
        const unidades = Number(cantidad);
        if (!Number.isInteger(unidades) || unidades <= 0) {
            return res.status(400).json({ error: 'La cantidad debe ser un número entero mayor que cero' });
        }
        const motivo = typeof req.body.motivo === 'string' && req.body.motivo.trim() ? req.body.motivo.trim().slice(0, 160) : null;

        // Todo cambio de stock pasa por un movimiento: queda historial y nunca baja de cero.
        const r = await inventario.ajustarStock(db, {
            negocioId: req.negocioId, productoId: Number(id),
            tipo: operacion === 'agregar' ? 'entrada' : 'ajuste',
            delta: operacion === 'agregar' ? unidades : -unidades,
            motivo: motivo || (operacion === 'agregar' ? 'Entrada de mercancía' : 'Salida manual'),
        });

        res.json({
            success: true,
            message: `Stock ${operacion === 'agregar' ? 'aumentado' : 'disminuido'} correctamente`,
            stock_anterior: r.stock_anterior,
            stock_nuevo: r.stock_nuevo
        });
    } catch (error) {
        if (error instanceof inventario.ErrorInventario && error.codigo === 'STOCK_INSUFICIENTE') {
            return res.status(400).json({ error: 'Stock insuficiente', stock_actual: error.detalle.disponible, cantidad_solicitada: error.detalle.pedido });
        }
        if (responderErrorInventario(res, error)) return;
        console.error('[Productos] Error:', error.message);
        res.status(500).json({ error: 'Error al actualizar stock' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.execute(
            'UPDATE productos SET activo = 0 WHERE id = ? AND negocio_id = ?',
            [id, req.negocioId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ mensaje: 'Producto eliminado', success: true });
    } catch (error) {
        console.error('[Productos] Error:', error.message);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
});

module.exports = router;
