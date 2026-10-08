const express = require('express');
const router = express.Router();
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { checkProductLimit } = require('../middleware/tenant');

// Router canónico para /api/productos. Reemplaza la implementación duplicada
// que vivía en routes/all.js (pool de MySQL propio) y el archivo
// routes/products.js, que existía pero nunca se montaba en index.js.
router.use(verificarAuth);

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

        const [result] = await db.execute(
            `INSERT INTO productos (negocio_id, nombre, descripcion, precio, stock, activo, imagen_url, categoria, restaurante_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.negocioId, nombre, descripcion || null, precio, stock || 0, activo !== false, imagen_url || null, categoria || null, restauranteIdValido]
        );

        const [nuevoProducto] = await db.execute('SELECT * FROM productos WHERE id = ?', [result.insertId]);

        res.status(201).json({ mensaje: 'Producto creado', id: result.insertId, producto: nuevoProducto[0] });
    } catch (error) {
        console.error('[Productos] Error:', error.message);
        res.status(500).json({ error: 'Error al crear producto' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, precio, stock, activo, imagen_url, categoria, restaurante_id } = req.body;

        const updates = [];
        const params = [];
        if (nombre !== undefined) { updates.push('nombre = ?'); params.push(nombre); }
        if (descripcion !== undefined) { updates.push('descripcion = ?'); params.push(descripcion); }
        if (precio !== undefined) { updates.push('precio = ?'); params.push(precio); }
        if (stock !== undefined) { updates.push('stock = ?'); params.push(stock); }
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

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        params.push(id, req.negocioId);

        const [result] = await db.execute(
            `UPDATE productos SET ${updates.join(', ')} WHERE id = ? AND negocio_id = ?`,
            params
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const [productoActualizado] = await db.execute('SELECT * FROM productos WHERE id = ?', [id]);

        res.json({ mensaje: 'Producto actualizado', producto: productoActualizado[0] });
    } catch (error) {
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

        const [producto] = await db.execute(
            'SELECT * FROM productos WHERE id = ? AND negocio_id = ?',
            [id, req.negocioId]
        );

        if (producto.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        let nuevoStock;
        if (operacion === 'agregar') {
            nuevoStock = producto[0].stock + cantidad;
        } else {
            nuevoStock = producto[0].stock - cantidad;
            if (nuevoStock < 0) {
                return res.status(400).json({
                    error: 'Stock insuficiente',
                    stock_actual: producto[0].stock,
                    cantidad_solicitada: cantidad
                });
            }
        }

        await db.execute(
            'UPDATE productos SET stock = ? WHERE id = ? AND negocio_id = ?',
            [nuevoStock, id, req.negocioId]
        );

        res.json({
            success: true,
            message: `Stock ${operacion === 'agregar' ? 'aumentado' : 'disminuido'} correctamente`,
            stock_anterior: producto[0].stock,
            stock_nuevo: nuevoStock
        });
    } catch (error) {
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
