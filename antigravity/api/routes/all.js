const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const { injectTenantId, checkProductLimit } = require('../middleware/tenant');
const { isTokenBlacklisted } = require('../middleware/security');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'antigravity',
    waitForConnections: true,
    connectionLimit: 10
});

const JWT_SECRET = process.env.JWT_SECRET || 'antigravity_secret_key';

async function verificarAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token requerido' });
        }
        const token = authHeader.substring(7);

        // Verificar si el token está en la lista negra
        if (await isTokenBlacklisted(token)) {
            return res.status(401).json({ error: 'Token revocado (sesión cerrada)' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.negocio = decoded;
        req.negocioId = decoded.negocio_id;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
}

// ============ AUTH (DUPLICADO - now handled by routes/auth.js) ============

/*
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [negocios] = await pool.query(
            'SELECT * FROM negocios WHERE email_dueno = ?',
            [email]
        );

        if (negocios.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const negocio = negocios[0];
        // Demo: acepta cualquier password para demo
        const passwordValida = (email === 'demo@antigravity.co') || (password === 'Demo2024#');

        if (!passwordValida) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { negocio_id: negocio.id, email: negocio.email_dueno, plan: negocio.plan, nombre: negocio.nombre },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            negocio: {
                id: negocio.id,
                nombre: negocio.nombre,
                email: negocio.email_dueno,
                plan: negocio.plan,
                color_principal: negocio.color_principal || '#00D9FF',
                logo_url: negocio.logo_url,
                onboarding_completado: Boolean(negocio.onboarding_completado),
                trial_hasta: negocio.trial_hasta,
                suscripcion_activa: Boolean(negocio.suscripcion_activa)
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

router.post('/auth/registro', async (req, res) => {
    try {
        const { email_dueno, password, nombre, whatsapp } = req.body;
        
        const [existente] = await pool.query(
            'SELECT id FROM negocios WHERE email_dueno = ?',
            [email_dueno]
        );

        if (existente.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        const trialHasta = new Date();
        trialHasta.setDate(trialHasta.getDate() + 7);

        const [result] = await pool.query(
            `INSERT INTO negocios (nombre, email_dueno, whatsapp, password, plan, trial_hasta, terminos_aceptados, color_principal) 
             VALUES (?, ?, ?, ?, 'starter', ?, true, '#00D9FF')`,
            [nombre, email_dueno, whatsapp || '', password || 'demo123', trialHasta]
        );

        const token = jwt.sign(
            { negocio_id: result.insertId, email: email_dueno, plan: 'starter', nombre },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            negocio: {
                id: result.insertId,
                nombre,
                email: email_dueno,
                plan: 'starter',
                color_principal: '#00D9FF',
                onboarding_completado: false,
                trial_hasta: trialHasta,
                suscripcion_activa: false
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear cuenta' });
    }
});

router.get('/auth/verify', verificarAuth, async (req, res) => {
    try {
        const [negocios] = await pool.query(
            'SELECT * FROM negocios WHERE id = ?',
            [req.negocio.negocio_id]
        );

        if (negocios.length === 0) {
            return res.status(401).json({ error: 'Negocio no encontrado' });
        }

        const negocio = negocios[0];
        res.json({
            negocio: {
                id: negocio.id,
                nombre: negocio.nombre,
                email: negocio.email_dueno,
                plan: negocio.plan,
                color_principal: negocio.color_principal,
                logo_url: negocio.logo_url,
                onboarding_completado: Boolean(negocio.onboarding_completado),
                trial_hasta: negocio.trial_hasta,
                suscripcion_activa: Boolean(negocio.suscripcion_activa)
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error' });
    }
});

router.post('/auth/logout', (req, res) => {
    res.json({ mensaje: 'Sesión cerrada' });
});
*/

// ============ PEDIDOS ============

router.get('/pedidos', verificarAuth, async (req, res) => {
    try {
        const { estado, busqueda } = req.query;
        let query = `
            SELECT p.*, c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp
            FROM pedidos p 
            LEFT JOIN clientes c ON p.cliente_id = c.id 
            WHERE p.negocio_id = ?
        `;
        let params = [req.negocio.negocio_id];

        if (estado) {
            query += ' AND p.estado = ?';
            params.push(estado);
        }
        if (busqueda) {
            query += ' AND (c.nombre LIKE ? OR p.numero_pedido LIKE ?)';
            params.push(`%${busqueda}%`, `%${busqueda}%`);
        }

        query += ' ORDER BY p.created_at DESC LIMIT 50';

        const [pedidos] = await pool.query(query, params);

        for (const pedido of pedidos) {
            // Obtener ítems asociados
            const [items] = await pool.query(
                `SELECT ip.*, pr.nombre as producto_nombre, pr.precio as producto_precio
                 FROM items_pedido ip 
                 JOIN productos pr ON ip.producto_id = pr.id 
                 WHERE ip.pedido_id = ?`,
                [pedido.id]
            );
            pedido.items = items.map(item => ({
                id: item.id,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                subtotal: item.subtotal,
                producto: {
                    nombre: item.producto_nombre,
                    precio: item.producto_precio
                }
            }));
            
            // Anidar datos de cliente para el frontend
            pedido.cliente = {
                nombre: pedido.cliente_nombre,
                whatsapp: pedido.cliente_whatsapp
            };
        }

        res.json({ pedidos });
    } catch (error) {
        console.error('[API All] Error al obtener pedidos:', error);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

router.put('/pedidos/:id', verificarAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        await pool.query(
            'UPDATE pedidos SET estado = ? WHERE id = ? AND negocio_id = ?',
            [estado, id, req.negocio.negocio_id]
        );

        res.json({ mensaje: 'Pedido actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar pedido' });
    }
});

// ============ PRODUCTOS ============

router.get('/productos', verificarAuth, async (req, res) => {
    try {
        const [productos] = await pool.query(
            'SELECT * FROM productos WHERE negocio_id = ? ORDER BY created_at DESC',
            [req.negocio.negocio_id]
        );
        res.json({ productos });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

router.post('/productos', verificarAuth, injectTenantId, checkProductLimit, async (req, res) => {
    try {
        const { nombre, descripcion, precio, stock, activo } = req.body;

        const [result] = await pool.query(
            'INSERT INTO productos (negocio_id, nombre, descripcion, precio, stock, activo) VALUES (?, ?, ?, ?, ?, ?)',
            [req.negocio.negocio_id, nombre, descripcion, precio, stock, activo ?? true]
        );

        res.status(201).json({ mensaje: 'Producto creado', id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear producto' });
    }
});

router.put('/productos/:id', verificarAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, precio, stock, activo } = req.body;

        await pool.query(
            'UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?, activo = ? WHERE id = ? AND negocio_id = ?',
            [nombre, descripcion, precio, stock, activo, id, req.negocio.negocio_id]
        );

        res.json({ mensaje: 'Producto actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
});

router.delete('/productos/:id', verificarAuth, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM productos WHERE id = ? AND negocio_id = ?',
            [req.params.id, req.negocio.negocio_id]
        );
        res.json({ mensaje: 'Producto eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
});

// ============ ANALYTICS ============

router.get('/analytics/resumen', verificarAuth, async (req, res) => {
    try {
        const [[ventasTotal]] = await pool.query(
            `SELECT COALESCE(SUM(total), 0) as total FROM pedidos 
             WHERE negocio_id = ? AND estado = 'entregado'`,
            [req.negocio.negocio_id]
        );

        const [[pedidosTotal]] = await pool.query(
            `SELECT COUNT(*) as total FROM pedidos WHERE negocio_id = ?`,
            [req.negocio.negocio_id]
        );

        const [[mensajesTotal]] = await pool.query(
            `SELECT COUNT(*) as total FROM conversaciones WHERE negocio_id = ?`,
            [req.negocio.negocio_id]
        );

        res.json({
            ventas_hoy: ventasTotal.total,
            pedidos_hoy: pedidosTotal.total,
            mensajes_hoy: mensajesTotal.total,
            tasa_ia: 87
        });
    } catch (error) {
        res.status(500).json({ error: 'Error' });
    }
});

router.get('/analytics/ventas', verificarAuth, async (req, res) => {
    try {
        const [ventas] = await pool.query(
            `SELECT DATE(created_at) as fecha, SUM(total) as ventas, COUNT(*) as pedidos
             FROM pedidos 
             WHERE negocio_id = ? AND estado = 'entregado'
             GROUP BY DATE(created_at)
             ORDER BY fecha DESC LIMIT 7`,
            [req.negocio.negocio_id]
        );
        res.json({ ventas });
    } catch (error) {
        res.json({ ventas: [] });
    }
});

// ============ CONVERSACIONES ============

router.get('/chat/conversaciones', verificarAuth, async (req, res) => {
    try {
        const [conversaciones] = await pool.query(
            `SELECT c.*, cl.nombre as cliente_nombre, cl.whatsapp as cliente_whatsapp
             FROM conversaciones c
             LEFT JOIN clientes cl ON c.cliente_id = cl.id
             WHERE c.negocio_id = ?
             ORDER BY c.updated_at DESC
             LIMIT 30`,
            [req.negocio.negocio_id]
        );
        res.json({ conversaciones });
    } catch (error) {
        res.json({ conversaciones: [] });
    }
});

// ============ BUSINESS ============

router.get('/business/perfil', verificarAuth, async (req, res) => {
    try {
        const [negocios] = await pool.query(
            'SELECT * FROM negocios WHERE id = ?',
            [req.negocio.negocio_id]
        );
        res.json({ negocio: negocios[0] });
    } catch (error) {
        res.status(500).json({ error: 'Error' });
    }
});

router.put('/business/perfil', verificarAuth, async (req, res) => {
    try {
        const { nombre, telefono, ciudad, direccion } = req.body;
        await pool.query(
            'UPDATE negocios SET nombre = ?, telefono = ?, ciudad = ?, direccion = ? WHERE id = ?',
            [nombre, telefono, ciudad, direccion, req.negocio.negocio_id]
        );
        res.json({ mensaje: 'Perfil actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error' });
    }
});

router.get('/business/plan', verificarAuth, async (req, res) => {
    try {
        const [negocios] = await pool.query(
            'SELECT plan, suscripcion_activa, suscripcion_fin, trial_hasta FROM negocios WHERE id = ?',
            [req.negocio.negocio_id]
        );

        const plan = negocios[0];
        const prices = { starter: 450000, professional: 850000, enterprise: 1800000 };
        
        res.json({
            plan: {
                tipo: plan.plan,
                precio: prices[plan.plan],
                activo: Boolean(plan.suscripcion_activa),
                trial_hasta: plan.trial_hasta
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error' });
    }
});

module.exports = router;
