const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'antigravity_secret_key';
const TRACKING_BASE_URL = process.env.TRACKING_BASE_URL || 'http://localhost:5177/delivery/track';

function generarTrackingToken() {
    return crypto.randomBytes(32).toString('hex');
}

const INSTANCE_MANAGER_URL = process.env.INSTANCE_MANAGER_URL || 'http://localhost:3001';

async function enviarNotificacionWhatsApp(negocioId, numero, mensaje) {
    try {
        await axios.post(`${INSTANCE_MANAGER_URL}/internal/message`, {
            negocio_id: negocioId,
            numero: numero.startsWith('+') ? numero : `+${numero}`,
            mensaje
        }, { timeout: 5000 });
    } catch (err) {
        console.error('[Domicilios] Error enviando notificación WhatsApp:', err.message);
    }
}

function generarTokenDomiciliario(domiciliario) {
    return jwt.sign(
        { id: domiciliario.id, negocio_id: domiciliario.negocio_id, nombre: domiciliario.nombre, tipo: 'domiciliario' },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function verificarAuthDomiciliario(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token requerido', codigo: 'SIN_TOKEN' });
    }
    try {
        const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET);
        if (decoded.tipo !== 'domiciliario') {
            return res.status(403).json({ error: 'No autorizado', codigo: 'TIPO_INVALIDO' });
        }
        req.domiciliario = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido', codigo: 'TOKEN_INVALIDO' });
    }
}

router.get('/modulos/check', verificarAuth, async (req, res) => {
    try {
        const [modulos] = await db.execute(
            'SELECT activo, config FROM negocio_modulos WHERE negocio_id = ? AND modulo_name = ?',
            [req.negocio.id, 'domicilios']
        );
        res.json({ activo: modulos.length > 0 && modulos[0].activo, config: modulos[0]?.config || null });
    } catch (error) {
        res.status(500).json({ error: 'Error al verificar módulo' });
    }
});

router.get('/drivers', verificarAuth, async (req, res) => {
    try {
        const [drivers] = await db.execute(
            `SELECT d.id, d.nombre, d.telefono, d.latitud, d.longitud, d.estado_activo, d.activo, d.created_at,
                    COUNT(CASE WHEN dom.estado = 'entregado' THEN 1 END) as pedidos_completados,
                    COALESCE(SUM(CASE WHEN dom.estado = 'entregado' THEN dom.km_recorridos ELSE 0 END), 0) as km_totales,
                    COALESCE(SUM(CASE WHEN dom.estado = 'entregado' THEN dom.tarifa_envio ELSE 0 END), 0) as ganancias_totales
             FROM domiciliarios d
             LEFT JOIN domicilios dom ON d.id = dom.domiciliario_id
             WHERE d.negocio_id = ? AND d.activo = 1
             GROUP BY d.id
             ORDER BY d.created_at DESC`,
            [req.negocio.id]
        );

        const [pendientes] = await db.execute(
            `SELECT COUNT(*) as total FROM domicilios WHERE negocio_id = ? AND estado = 'pendiente'`,
            [req.negocio.id]
        );

        const [enRuta] = await db.execute(
            `SELECT COUNT(*) as total FROM domicilios WHERE negocio_id = ? AND estado IN ('aceptado', 'en_ruta')`,
            [req.negocio.id]
        );

        res.json({ success: true, data: drivers, conteo: { pendientes: pendientes[0].total, en_ruta: enRuta[0].total } });
    } catch (error) {
        console.error('[Domicilios] Error listing drivers:', error);
        res.status(500).json({ error: 'Error al listar domiciliarios' });
    }
});

router.post('/drivers', verificarAuth, async (req, res) => {
    try {
        const { nombre, telefono, pin } = req.body;

        if (!nombre || !telefono || !pin) {
            return res.status(400).json({ error: 'nombre, telefono y pin son requeridos' });
        }

        if (pin.length < 4) {
            return res.status(400).json({ error: 'El PIN debe tener al menos 4 caracteres' });
        }

        const [existing] = await db.execute(
            'SELECT id FROM domiciliarios WHERE negocio_id = ? AND telefono = ? AND activo = 1',
            [req.negocio.id, telefono]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Ya existe un domiciliario con ese teléfono' });
        }

        const clave_pin = await bcrypt.hash(pin, 10);

        const [result] = await db.execute(
            'INSERT INTO domiciliarios (negocio_id, nombre, telefono, clave_pin) VALUES (?, ?, ?, ?)',
            [req.negocio.id, nombre, telefono, clave_pin]
        );

        res.status(201).json({
            success: true,
            message: 'Domiciliario creado',
            data: { id: result.insertId, nombre, telefono }
        });
    } catch (error) {
        console.error('[Domicilios] Error creating driver:', error);
        res.status(500).json({ error: 'Error al crear domiciliario' });
    }
});

router.put('/drivers/:id', verificarAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, telefono, pin } = req.body;

        const [drivers] = await db.execute(
            'SELECT id FROM domiciliarios WHERE id = ? AND negocio_id = ? AND activo = 1',
            [id, req.negocio.id]
        );

        if (drivers.length === 0) {
            return res.status(404).json({ error: 'Domiciliario no encontrado' });
        }

        const updates = [];
        const values = [];

        if (nombre) { updates.push('nombre = ?'); values.push(nombre); }
        if (telefono) { updates.push('telefono = ?'); values.push(telefono); }
        if (pin) {
            const clave_pin = await bcrypt.hash(pin, 10);
            updates.push('clave_pin = ?');
            values.push(clave_pin);
        }

        if (updates.length > 0) {
            values.push(id);
            await db.execute(
                `UPDATE domiciliarios SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }

        res.json({ success: true, message: 'Domiciliario actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar domiciliario' });
    }
});

router.delete('/drivers/:id', verificarAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.execute(
            'UPDATE domiciliarios SET activo = 0 WHERE id = ? AND negocio_id = ?',
            [id, req.negocio.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Domiciliario no encontrado' });
        }

        res.json({ success: true, message: 'Domiciliario desactivado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al desactivar domiciliario' });
    }
});

router.get('/active', verificarAuth, async (req, res) => {
    try {
        const [pendientes] = await db.execute(
            `SELECT dom.id, dom.estado, dom.tracking_token, dom.created_at,
                    p.id as pedido_id, p.numero_pedido, p.total, p.direccion_entrega,
                    c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp
             FROM domicilios dom
             JOIN pedidos p ON dom.pedido_id = p.id
             JOIN clientes c ON p.cliente_id = c.id
             WHERE dom.negocio_id = ? AND dom.estado = 'pendiente'
             ORDER BY dom.created_at ASC`,
            [req.negocio.id]
        );

        const [enCurso] = await db.execute(
            `SELECT dom.id, dom.estado, dom.tracking_token, dom.km_recorridos, dom.tiempo_minutos, dom.tarifa_envio,
                    dom.created_at, dom.updated_at,
                    p.id as pedido_id, p.numero_pedido, p.total, p.direccion_entrega,
                    c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp,
                    d.nombre as domiciliario_nombre, d.telefono as domiciliario_telefono,
                    d.latitud, d.longitud
             FROM domicilios dom
             JOIN pedidos p ON dom.pedido_id = p.id
             JOIN clientes c ON p.cliente_id = c.id
             LEFT JOIN domiciliarios d ON dom.domiciliario_id = d.id
             WHERE dom.negocio_id = ? AND dom.estado IN ('aceptado', 'en_ruta')
             ORDER BY dom.updated_at DESC`,
            [req.negocio.id]
        );

        const [completados] = await db.execute(
            `SELECT dom.id, dom.estado, dom.km_recorridos, dom.tiempo_minutos, dom.tarifa_envio, dom.updated_at,
                    p.id as pedido_id, p.numero_pedido, p.total,
                    c.nombre as cliente_nombre,
                    d.nombre as domiciliario_nombre
             FROM domicilios dom
             JOIN pedidos p ON dom.pedido_id = p.id
             JOIN clientes c ON p.cliente_id = c.id
             LEFT JOIN domiciliarios d ON dom.domiciliario_id = d.id
             WHERE dom.negocio_id = ? AND dom.estado = 'entregado'
             ORDER BY dom.updated_at DESC
             LIMIT 20`,
            [req.negocio.id]
        );

        res.json({
            success: true,
            data: { pendientes, en_curso: enCurso, completados }
        });
    } catch (error) {
        console.error('[Domicilios] Error listing active:', error);
        res.status(500).json({ error: 'Error al listar entregas activas' });
    }
});

router.post('/assign', verificarAuth, async (req, res) => {
    try {
        const { domicilio_id, domiciliario_id } = req.body;

        if (!domicilio_id || !domiciliario_id) {
            return res.status(400).json({ error: 'domicilio_id y domiciliario_id requeridos' });
        }

        const [domicilio] = await db.execute(
            'SELECT id, estado FROM domicilios WHERE id = ? AND negocio_id = ?',
            [domicilio_id, req.negocio.id]
        );

        if (domicilio.length === 0) {
            return res.status(404).json({ error: 'Domicilio no encontrado' });
        }

        if (domicilio[0].estado !== 'pendiente') {
            return res.status(400).json({ error: 'El domicilio no está pendiente' });
        }

        const [driver] = await db.execute(
            'SELECT id, estado_activo FROM domiciliarios WHERE id = ? AND negocio_id = ? AND activo = 1',
            [domiciliario_id, req.negocio.id]
        );

        if (driver.length === 0) {
            return res.status(404).json({ error: 'Domiciliario no encontrado' });
        }

        await db.execute(
            'UPDATE domicilios SET domiciliario_id = ?, estado = "aceptado", updated_at = NOW() WHERE id = ?',
            [domiciliario_id, domicilio_id]
        );

        const [domActualizado] = await db.execute(
            `SELECT dom.*, d.nombre as domiciliario_nombre, d.telefono as domiciliario_telefono
             FROM domicilios dom
             JOIN domiciliarios d ON dom.domiciliario_id = d.id
             WHERE dom.id = ?`,
            [domicilio_id]
        );

        try {
            const { io } = require('../index');
            if (io) {
                const data = domActualizado[0];
                io.to(`negocio_${req.negocio.id}`).emit('domicilio_asignado', data);
                io.to(`tracking_${data.tracking_token}`).emit('domicilio_actualizado', { estado: 'aceptado', domiciliario: { nombre: data.domiciliario_nombre } });
            }
        } catch (e) {}

        const [pedidoCliente] = await db.execute(
            `SELECT c.whatsapp FROM domicilios dom
             JOIN pedidos p ON dom.pedido_id = p.id
             JOIN clientes c ON p.cliente_id = c.id
             WHERE dom.id = ?`,
            [domicilio_id]
        );

        if (pedidoCliente[0]?.whatsapp) {
            enviarNotificacionWhatsApp(
                req.negocio.id,
                pedidoCliente[0].whatsapp,
                `🛵 Tu pedido ha sido asignado a ${domActualizado[0].domiciliario_nombre} y estará en camino pronto.`
            );
        }

        res.json({ success: true, message: 'Domicilio asignado', data: domActualizado[0] });
    } catch (error) {
        console.error('[Domicilios] Error assigning:', error);
        res.status(500).json({ error: 'Error al asignar domicilio' });
    }
});

router.post('/driver/login', async (req, res) => {
    try {
        const { telefono, pin } = req.body;

        if (!telefono || !pin) {
            return res.status(400).json({ error: 'teléfono y pin requeridos' });
        }

        const [drivers] = await db.execute(
            'SELECT * FROM domiciliarios WHERE telefono = ? AND activo = 1',
            [telefono]
        );

        if (drivers.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const driver = drivers[0];
        const pinValido = await bcrypt.compare(pin, driver.clave_pin);

        if (!pinValido) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = generarTokenDomiciliario(driver);

        res.json({
            success: true,
            token,
            data: {
                id: driver.id,
                nombre: driver.nombre,
                telefono: driver.telefono,
                estado_activo: driver.estado_activo,
                negocio_id: driver.negocio_id
            }
        });
    } catch (error) {
        console.error('[Domicilios] Error login:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

router.post('/driver/status', verificarAuthDomiciliario, async (req, res) => {
    try {
        const { activo } = req.body;

        await db.execute(
            'UPDATE domiciliarios SET estado_activo = ? WHERE id = ?',
            [activo ? 1 : 0, req.domiciliario.id]
        );

        try {
            const { io } = require('../index');
            if (io) {
                io.to(`negocio_${req.domiciliario.negocio_id}`).emit('driver_status', {
                    domiciliario_id: req.domiciliario.id,
                    estado_activo: activo,
                    nombre: req.domiciliario.nombre
                });
            }
        } catch (e) {}

        res.json({ success: true, message: activo ? 'Conectado' : 'Desconectado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

router.get('/driver/stats', verificarAuthDomiciliario, async (req, res) => {
    try {
        const hoy = new Date().toISOString().split('T')[0];

        const [stats] = await db.execute(
            `SELECT
                COUNT(CASE WHEN estado = 'entregado' THEN 1 END) as pedidos_hoy,
                COALESCE(SUM(CASE WHEN estado = 'entregado' THEN tarifa_envio ELSE 0 END), 0) as ganancias_hoy,
                COALESCE(SUM(CASE WHEN estado = 'entregado' THEN km_recorridos ELSE 0 END), 0) as km_hoy,
                COUNT(CASE WHEN estado IN ('aceptado', 'en_ruta') THEN 1 END) as activos
             FROM domicilios
             WHERE domiciliario_id = ? AND DATE(created_at) = ?`,
            [req.domiciliario.id, hoy]
        );

        const [totalStats] = await db.execute(
            `SELECT
                COUNT(*) as total_pedidos,
                COALESCE(SUM(km_recorridos), 0) as total_km,
                COALESCE(SUM(tarifa_envio), 0) as total_ganancias,
                COALESCE(SUM(tiempo_minutos), 0) as total_minutos
             FROM domicilios
             WHERE domiciliario_id = ? AND estado = 'entregado'`,
            [req.domiciliario.id]
        );

        const [conteoPendientes] = await db.execute(
            'SELECT COUNT(*) as total FROM domicilios WHERE negocio_id = ? AND estado = "pendiente"',
            [req.domiciliario.negocio_id]
        );

        res.json({
            success: true,
            data: {
                hoy: stats[0],
                total: totalStats[0],
                pendientes: conteoPendientes[0].total
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

router.get('/driver/orders', verificarAuthDomiciliario, async (req, res) => {
    try {
        const [pendientes] = await db.execute(
            `SELECT dom.id as domicilio_id, dom.estado, dom.created_at, dom.tarifa_envio,
                    p.id as pedido_id, p.numero_pedido, p.total, p.direccion_entrega,
                    c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp
             FROM domicilios dom
             JOIN pedidos p ON dom.pedido_id = p.id
             JOIN clientes c ON p.cliente_id = c.id
             WHERE dom.negocio_id = ? AND dom.estado = 'pendiente'
             ORDER BY dom.created_at ASC`,
            [req.domiciliario.negocio_id]
        );

        const [miEntrega] = await db.execute(
            `SELECT dom.*, p.numero_pedido, p.total, p.direccion_entrega,
                    c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp
             FROM domicilios dom
             JOIN pedidos p ON dom.pedido_id = p.id
             JOIN clientes c ON p.cliente_id = c.id
             WHERE dom.domiciliario_id = ? AND dom.estado IN ('aceptado', 'en_ruta')
             LIMIT 1`,
            [req.domiciliario.id]
        );

        res.json({
            success: true,
            data: {
                pendientes,
                mi_entrega: miEntrega[0] || null
            }
        });
    } catch (error) {
        console.error('[Domicilios] Error driver orders:', error);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

router.post('/driver/accept', verificarAuthDomiciliario, async (req, res) => {
    try {
        const { domicilio_id } = req.body;

        if (!domicilio_id) {
            return res.status(400).json({ error: 'domicilio_id requerido' });
        }

        const [domicilio] = await db.execute(
            'SELECT id, estado FROM domicilios WHERE id = ? AND negocio_id = ? AND estado = "pendiente"',
            [domicilio_id, req.domiciliario.negocio_id]
        );

        if (domicilio.length === 0) {
            return res.status(404).json({ error: 'Domicilio no disponible' });
        }

        await db.execute(
            'UPDATE domicilios SET domiciliario_id = ?, estado = "aceptado", updated_at = NOW() WHERE id = ?',
            [req.domiciliario.id, domicilio_id]
        );

        const [domActualizado] = await db.execute(
            `SELECT dom.*, d.nombre as domiciliario_nombre, d.telefono as domiciliario_telefono
             FROM domicilios dom
             JOIN domiciliarios d ON dom.domiciliario_id = d.id
             WHERE dom.id = ?`,
            [domicilio_id]
        );

        try {
            const { io } = require('../index');
            if (io) {
                io.to(`negocio_${req.domiciliario.negocio_id}`).emit('domicilio_asignado', domActualizado[0]);
                io.to(`tracking_${domActualizado[0].tracking_token}`).emit('domicilio_actualizado', {
                    estado: 'aceptado',
                    domiciliario: { nombre: domActualizado[0].domiciliario_nombre }
                });
            }
        } catch (e) {}

        res.json({ success: true, message: 'Domicilio aceptado', data: domActualizado[0] });
    } catch (error) {
        console.error('[Domicilios] Error accepting:', error);
        res.status(500).json({ error: 'Error al aceptar domicilio' });
    }
});

router.post('/driver/update-status', verificarAuthDomiciliario, async (req, res) => {
    try {
        const { domicilio_id, estado } = req.body;

        if (!domicilio_id || !estado) {
            return res.status(400).json({ error: 'domicilio_id y estado requeridos' });
        }

        if (!['aceptado', 'en_ruta', 'entregado', 'cancelado'].includes(estado)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }

        const [domicilio] = await db.execute(
            'SELECT id, estado, tracking_token, km_recorridos, tiempo_minutos FROM domicilios WHERE id = ? AND domiciliario_id = ?',
            [domicilio_id, req.domiciliario.id]
        );

        if (domicilio.length === 0) {
            return res.status(404).json({ error: 'Domicilio no encontrado' });
        }

        const estadoActual = domicilio[0].estado;
        const TRANSICIONES = { pendiente: ['aceptado'], aceptado: ['en_ruta', 'cancelado'], en_ruta: ['entregado', 'cancelado'] };

        if (!TRANSICIONES[estadoActual]?.includes(estado)) {
            return res.status(400).json({
                error: `No se puede cambiar de ${estadoActual} a ${estado}`,
                transiciones_permitidas: TRANSICIONES[estadoActual] || []
            });
        }

        await db.execute(
            'UPDATE domicilios SET estado = ?, updated_at = NOW() WHERE id = ?',
            [estado, domicilio_id]
        );

        const { io } = require('../index');

        if (estado === 'en_ruta') {
            const [domData] = await db.execute(
                `SELECT dom.tracking_token, p.cliente_id, c.whatsapp as cliente_whatsapp
                 FROM domicilios dom
                 JOIN pedidos p ON dom.pedido_id = p.id
                 JOIN clientes c ON p.cliente_id = c.id
                 WHERE dom.id = ?`,
                [domicilio_id]
            );

            if (io) {
                io.to(`tracking_${domData[0].tracking_token}`).emit('domicilio_actualizado', {
                    estado: 'en_ruta',
                    domiciliario: { nombre: req.domiciliario.nombre }
                });
                io.to(`negocio_${req.domiciliario.negocio_id}`).emit('domicilio_en_ruta', { domicilio_id });
            }

            if (domData[0]?.cliente_whatsapp) {
                enviarNotificacionWhatsApp(
                    req.domiciliario.negocio_id,
                    domData[0].cliente_whatsapp,
                    `🛵 ¡Buenas noticias! Tu pedido ya está en camino a cargo de ${req.domiciliario.nombre}.\n\nSíguelo en tiempo real aquí:\n${TRACKING_BASE_URL}/${domData[0].tracking_token}`
                );
            }
        }

        if (estado === 'entregado') {
            const [domData] = await db.execute(
                `SELECT dom.tracking_token, p.cliente_id, c.whatsapp as cliente_whatsapp
                 FROM domicilios dom
                 JOIN pedidos p ON dom.pedido_id = p.id
                 JOIN clientes c ON p.cliente_id = c.id
                 WHERE dom.id = ?`,
                [domicilio_id]
            );

            if (io) {
                io.to(`tracking_${domData[0].tracking_token}`).emit('domicilio_actualizado', { estado: 'entregado' });
                io.to(`negocio_${req.domiciliario.negocio_id}`).emit('domicilio_entregado', { domicilio_id });
            }

            if (domData[0]?.cliente_whatsapp) {
                enviarNotificacionWhatsApp(
                    req.domiciliario.negocio_id,
                    domData[0].cliente_whatsapp,
                    '🎉 ¡Tu pedido ha sido entregado! Gracias por comprar con nosotros.'
                );
            }
        }

        res.json({ success: true, message: `Estado actualizado a ${estado}` });
    } catch (error) {
        console.error('[Domicilios] Error update status:', error);
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

router.post('/driver/location', verificarAuthDomiciliario, async (req, res) => {
    try {
        const { latitud, longitud } = req.body;

        if (latitud === undefined || longitud === undefined) {
            return res.status(400).json({ error: 'latitud y longitud requeridos' });
        }

        await db.execute(
            'UPDATE domiciliarios SET latitud = ?, longitud = ? WHERE id = ?',
            [latitud, longitud, req.domiciliario.id]
        );

        const [entregasActivas] = await db.execute(
            `SELECT tracking_token FROM domicilios
             WHERE domiciliario_id = ? AND estado IN ('aceptado', 'en_ruta')`,
            [req.domiciliario.id]
        );

        try {
            const { io } = require('../index');
            if (io) {
                io.to(`negocio_${req.domiciliario.negocio_id}`).emit('driver_location', {
                    domiciliario_id: req.domiciliario.id,
                    nombre: req.domiciliario.nombre,
                    latitud,
                    longitud
                });

                for (const entrega of entregasActivas) {
                    io.to(`tracking_${entrega.tracking_token}`).emit('driver_location', {
                        latitud,
                        longitud
                    });
                }
            }
        } catch (e) {}

        res.json({ success: true });
    } catch (error) {
        console.error('[Domicilios] Error location:', error);
        res.status(500).json({ error: 'Error al actualizar ubicación' });
    }
});

router.get('/public/track/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const [domicilios] = await db.execute(
            `SELECT dom.estado, dom.created_at, dom.updated_at,
                    p.numero_pedido, p.total,
                    d.nombre as domiciliario_nombre, d.telefono as domiciliario_telefono,
                    d.latitud, d.longitud
             FROM domicilios dom
             JOIN pedidos p ON dom.pedido_id = p.id
             LEFT JOIN domiciliarios d ON dom.domiciliario_id = d.id
             WHERE dom.tracking_token = ?`,
            [token]
        );

        if (domicilios.length === 0) {
            return res.status(404).json({ error: 'Seguimiento no encontrado' });
        }

        res.json({ success: true, data: domicilios[0] });
    } catch (error) {
        console.error('[Domicilios] Error tracking:', error);
        res.status(500).json({ error: 'Error al obtener seguimiento' });
    }
});

router.post('/crear', verificarAuth, async (req, res) => {
    try {
        const { pedido_id, tarifa_envio = 5000 } = req.body;

        if (!pedido_id) {
            return res.status(400).json({ error: 'pedido_id requerido' });
        }

        const [pedidos] = await db.execute(
            'SELECT id, total, direccion_entrega FROM pedidos WHERE id = ? AND negocio_id = ?',
            [pedido_id, req.negocio.id]
        );

        if (pedidos.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        if (!pedidos[0].direccion_entrega) {
            return res.status(400).json({ error: 'El pedido no tiene dirección de entrega' });
        }

        const [existing] = await db.execute(
            'SELECT id FROM domicilios WHERE pedido_id = ?',
            [pedido_id]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'El pedido ya tiene un domicilio registrado' });
        }

        const tracking_token = generarTrackingToken();

        const [result] = await db.execute(
            `INSERT INTO domicilios (negocio_id, pedido_id, estado, tarifa_envio, tracking_token)
             VALUES (?, ?, 'pendiente', ?, ?)`,
            [req.negocio.id, pedido_id, tarifa_envio, tracking_token]
        );

        res.status(201).json({
            success: true,
            message: 'Domicilio creado para seguimiento',
            data: { id: result.insertId, tracking_token, tracking_url: `${TRACKING_BASE_URL}/${tracking_token}` }
        });
    } catch (error) {
        console.error('[Domicilios] Error creating domicilio:', error);
        res.status(500).json({ error: 'Error al crear domicilio' });
    }
});

module.exports = router;
