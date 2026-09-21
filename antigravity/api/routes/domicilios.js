const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { isAutomationActive, yaSeNotifico, registrarNotificacion } = require('../services/automationsService');
const { calcularCondicionesDomicilio } = require('../../instance-manager/services/domicilioTarifa');

const JWT_SECRET = process.env.JWT_SECRET;
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

// Ver el mismo helper en routes/pedidos.js — se duplica (en vez de importar
// uno desde el otro) porque son dos entradas distintas al mismo evento
// (dashboard vs. app de domiciliario) y así cada archivo queda autocontenido.
async function pedirResenaSiCorresponde(negocioId, pedidoId, numeroCliente) {
    try {
        const { activa } = await isAutomationActive(negocioId, 'resena');
        if (!activa || !numeroCliente) return;
        if (await yaSeNotifico(negocioId, 'resena', pedidoId)) return;

        const mensaje = '🎉 ¡Gracias por tu compra! Si tienes un segundo, nos encantaría que nos dejaras tu opinión sobre el pedido.';
        await enviarNotificacionWhatsApp(negocioId, numeroCliente, mensaje);
        await registrarNotificacion(negocioId, 'resena', 'Solicitud de reseña enviada', mensaje, pedidoId);
    } catch (error) {
        console.error('[Domicilios] Error pidiendo reseña:', error.message);
    }
}

const STRIKES_PARA_SUSPENDER = 3;
const DIAS_SUSPENSION = 7;

// Suspende automáticamente a un domiciliario que acumula demasiados
// incidentes (entregas tarde, robos confirmados) — igual que Rappi/Didi
// bajan la cuenta a un repartidor con mala tasa de cumplimiento, sin que
// el dueño del negocio tenga que estar revisando manualmente cada caso.
async function penalizarSiCorresponde(domiciliarioId, negocioId) {
    try {
        const [rows] = await db.execute('SELECT strikes, nombre FROM domiciliarios WHERE id = ?', [domiciliarioId]);
        if (rows.length === 0) return;
        if (rows[0].strikes >= STRIKES_PARA_SUSPENDER) {
            await db.execute(
                'UPDATE domiciliarios SET suspendido_hasta = DATE_ADD(NOW(), INTERVAL ? DAY), estado_activo = 0 WHERE id = ?',
                [DIAS_SUSPENSION, domiciliarioId]
            );
            await registrarNotificacion(
                negocioId, 'domicilio_suspension',
                'Domiciliario suspendido automáticamente',
                `${rows[0].nombre} acumuló ${rows[0].strikes} incidentes y quedó suspendido ${DIAS_SUSPENSION} días.`,
                domiciliarioId
            );
        }
    } catch (error) {
        console.error('[Domicilios] Error evaluando penalización:', error.message);
    }
}

async function obtenerTiempoLimiteMinutos(negocioId) {
    try {
        const [modulos] = await db.execute(
            `SELECT config FROM negocio_modulos WHERE negocio_id = ? AND modulo_name = 'domicilios'`,
            [negocioId]
        );
        if (modulos.length === 0) return 45;
        const config = typeof modulos[0].config === 'string' ? JSON.parse(modulos[0].config) : (modulos[0].config || {});
        return config.tiempo_limite_minutos || 45;
    } catch (e) {
        return 45;
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

// Configuración del módulo de domicilios que edita el dueño: tarifa por km
// (con mínimo/máximo opcionales), tarifa fija de respaldo y tiempo límite.
// Se mezcla con lo que ya haya en negocio_modulos.config, sin pisar otras claves.
const CAMPOS_CONFIG_DOMICILIOS = ['tarifa_por_km', 'tarifa_minima', 'tarifa_maxima', 'valor_fijo', 'tiempo_limite_minutos'];

router.put('/modulos/config', verificarAuth, async (req, res) => {
    try {
        const nuevos = {};
        for (const campo of CAMPOS_CONFIG_DOMICILIOS) {
            if (req.body[campo] === undefined) continue;
            const valor = req.body[campo] === null || req.body[campo] === '' ? null : Number(req.body[campo]);
            if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
                return res.status(400).json({ error: `${campo} debe ser un número mayor o igual a 0` });
            }
            nuevos[campo] = valor;
        }
        if (Object.keys(nuevos).length === 0) {
            return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
        }
        if (nuevos.tarifa_minima && nuevos.tarifa_maxima && nuevos.tarifa_minima > nuevos.tarifa_maxima) {
            return res.status(400).json({ error: 'La tarifa mínima no puede ser mayor que la máxima' });
        }

        const [modulos] = await db.execute(
            `SELECT config FROM negocio_modulos WHERE negocio_id = ? AND modulo_name = 'domicilios' AND activo = 1`,
            [req.negocio.id]
        );
        if (modulos.length === 0) {
            return res.status(404).json({ error: 'El módulo de domicilios no está activo para este negocio' });
        }

        let actual = {};
        try {
            actual = typeof modulos[0].config === 'string' ? JSON.parse(modulos[0].config) : (modulos[0].config || {});
        } catch (e) { actual = {}; }

        const config = { ...actual, ...nuevos };
        for (const k of Object.keys(config)) if (config[k] === null) delete config[k];

        await db.execute(
            `UPDATE negocio_modulos SET config = ? WHERE negocio_id = ? AND modulo_name = 'domicilios'`,
            [JSON.stringify(config), req.negocio.id]
        );

        res.json({ success: true, config });
    } catch (error) {
        console.error('[Domicilios] Error guardando config:', error);
        res.status(500).json({ error: 'Error al guardar la configuración' });
    }
});

router.get('/drivers', verificarAuth, async (req, res) => {
    try {
        const [drivers] = await db.execute(
            `SELECT d.id, d.nombre, d.telefono, d.latitud, d.longitud, d.estado_activo, d.activo, d.created_at,
                    d.score, d.strikes, d.suspendido_hasta,
                    COUNT(CASE WHEN dom.estado = 'entregado' THEN 1 END) as pedidos_completados,
                    COALESCE(SUM(CASE WHEN dom.estado = 'entregado' THEN dom.km_recorridos ELSE 0 END), 0) as km_totales,
                    COALESCE(SUM(CASE WHEN dom.estado = 'entregado' THEN dom.tarifa_envio ELSE 0 END), 0) as ganancias_totales
             FROM domiciliarios d
             LEFT JOIN domicilios dom ON d.id = dom.domiciliario_id
             WHERE d.negocio_id = ? AND d.activo = 1
             GROUP BY d.id
             ORDER BY d.score DESC, d.created_at DESC`,
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
            values.push(id, req.negocio.id);
            await db.execute(
                `UPDATE domiciliarios SET ${updates.join(', ')} WHERE id = ? AND negocio_id = ?`,
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

// Convierte la fila de un domicilio en lo que necesitan los mapas: `destino`
// {lat,lng} (dirección de entrega geocodificada) y `ruta` [[lat,lng],...]
// (polilínea negocio → cliente guardada al crear el domicilio). La polilínea de
// TravelTime trae cientos de puntos por ruta; se reduce a ~150 para no inflar
// las respuestas de las listas (se conservan siempre el primero y el último).
function normalizarRuta(fila) {
    if (!fila) return fila;
    let ruta = null;
    if (fila.ruta_coords) {
        try {
            const puntos = JSON.parse(fila.ruta_coords);
            if (Array.isArray(puntos) && puntos.length > 1) {
                const paso = Math.max(1, Math.ceil(puntos.length / 150));
                ruta = puntos.filter((_, i) => i % paso === 0);
                const ultimo = puntos[puntos.length - 1];
                if (ruta[ruta.length - 1] !== ultimo) ruta.push(ultimo);
            }
        } catch (e) { ruta = null; }
    }
    const destino = fila.direccion_lat != null && fila.direccion_lng != null
        ? { lat: Number(fila.direccion_lat), lng: Number(fila.direccion_lng) }
        : null;
    const { ruta_coords, direccion_lat, direccion_lng, ...resto } = fila;
    return { ...resto, ruta, destino };
}

router.get('/active', verificarAuth, async (req, res) => {
    try {
        const [negociosUbicacion] = await db.execute(
            'SELECT lat, lng, nombre FROM negocios WHERE id = ?',
            [req.negocio.id]
        );
        const negocioUbicacion = negociosUbicacion[0] && negociosUbicacion[0].lat != null
            ? { lat: Number(negociosUbicacion[0].lat), lng: Number(negociosUbicacion[0].lng), nombre: negociosUbicacion[0].nombre }
            : null;

        const [pendientes] = await db.execute(
            `SELECT dom.id, dom.estado, dom.tracking_token, dom.created_at, dom.ruta_coords,
                    p.id as pedido_id, p.numero_pedido, p.total, p.direccion_entrega, p.direccion_lat, p.direccion_lng,
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
                    dom.created_at, dom.updated_at, dom.ruta_coords,
                    p.id as pedido_id, p.numero_pedido, p.total, p.direccion_entrega, p.direccion_lat, p.direccion_lng,
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
            data: {
                pendientes: pendientes.map(normalizarRuta),
                en_curso: enCurso.map(normalizarRuta),
                completados,
                negocio_ubicacion: negocioUbicacion
            }
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
            'SELECT id, estado_activo, suspendido_hasta FROM domiciliarios WHERE id = ? AND negocio_id = ? AND activo = 1',
            [domiciliario_id, req.negocio.id]
        );

        if (driver.length === 0) {
            return res.status(404).json({ error: 'Domiciliario no encontrado' });
        }

        if (driver[0].suspendido_hasta && new Date(driver[0].suspendido_hasta) > new Date()) {
            return res.status(400).json({ error: `Este domiciliario está suspendido hasta ${new Date(driver[0].suspendido_hasta).toLocaleString('es-CO')}` });
        }

        const tiempoLimiteMinutos = await obtenerTiempoLimiteMinutos(req.negocio.id);

        await db.execute(
            'UPDATE domicilios SET domiciliario_id = ?, estado = "aceptado", limite_entrega_at = DATE_ADD(NOW(), INTERVAL ? MINUTE), updated_at = NOW() WHERE id = ?',
            [domiciliario_id, tiempoLimiteMinutos, domicilio_id]
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
                negocio_id: driver.negocio_id,
                score: driver.score,
                suspendido_hasta: driver.suspendido_hasta
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

        const [reputacion] = await db.execute(
            'SELECT score, strikes, suspendido_hasta FROM domiciliarios WHERE id = ?',
            [req.domiciliario.id]
        );

        res.json({
            success: true,
            data: {
                hoy: stats[0],
                total: totalStats[0],
                pendientes: conteoPendientes[0].total,
                reputacion: reputacion[0] || { score: 100, strikes: 0, suspendido_hasta: null }
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

router.get('/driver/orders', verificarAuthDomiciliario, async (req, res) => {
    try {
        const [pendientes] = await db.execute(
            `SELECT dom.id as domicilio_id, dom.estado, dom.created_at, dom.tarifa_envio, dom.km_recorridos, dom.tiempo_minutos, dom.ruta_coords,
                    p.id as pedido_id, p.numero_pedido, p.total, p.direccion_entrega, p.direccion_lat, p.direccion_lng,
                    c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp
             FROM domicilios dom
             JOIN pedidos p ON dom.pedido_id = p.id
             JOIN clientes c ON p.cliente_id = c.id
             WHERE dom.negocio_id = ? AND dom.estado = 'pendiente'
             ORDER BY dom.created_at ASC`,
            [req.domiciliario.negocio_id]
        );

        const [miEntrega] = await db.execute(
            `SELECT dom.*, dom.id as domicilio_id, p.numero_pedido, p.total, p.direccion_entrega, p.direccion_lat, p.direccion_lng,
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
                pendientes: pendientes.map(normalizarRuta),
                mi_entrega: normalizarRuta(miEntrega[0]) || null
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

        const [yo] = await db.execute(
            'SELECT suspendido_hasta FROM domiciliarios WHERE id = ?',
            [req.domiciliario.id]
        );
        if (yo[0]?.suspendido_hasta && new Date(yo[0].suspendido_hasta) > new Date()) {
            return res.status(403).json({ error: `Estás suspendido hasta ${new Date(yo[0].suspendido_hasta).toLocaleString('es-CO')} por incidentes anteriores` });
        }

        const [enDisputa] = await db.execute(
            `SELECT id FROM domicilios WHERE domiciliario_id = ? AND estado_incidente = 'en_disputa'`,
            [req.domiciliario.id]
        );
        if (enDisputa.length > 0) {
            return res.status(403).json({ error: 'Tienes una entrega en disputa sin resolver. No puedes tomar nuevos domicilios hasta que el negocio la revise.' });
        }

        const [domicilio] = await db.execute(
            'SELECT id, estado FROM domicilios WHERE id = ? AND negocio_id = ? AND estado = "pendiente"',
            [domicilio_id, req.domiciliario.negocio_id]
        );

        if (domicilio.length === 0) {
            return res.status(404).json({ error: 'Domicilio no disponible' });
        }

        const tiempoLimiteMinutos = await obtenerTiempoLimiteMinutos(req.domiciliario.negocio_id);

        await db.execute(
            'UPDATE domicilios SET domiciliario_id = ?, estado = "aceptado", limite_entrega_at = DATE_ADD(NOW(), INTERVAL ? MINUTE), updated_at = NOW() WHERE id = ?',
            [req.domiciliario.id, tiempoLimiteMinutos, domicilio_id]
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
        const { domicilio_id, estado, codigo_confirmacion } = req.body;

        if (!domicilio_id || !estado) {
            return res.status(400).json({ error: 'domicilio_id y estado requeridos' });
        }

        if (!['aceptado', 'en_ruta', 'entregado', 'cancelado'].includes(estado)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }

        const [domicilio] = await db.execute(
            'SELECT id, estado, tracking_token, km_recorridos, tiempo_minutos, codigo_confirmacion, limite_entrega_at FROM domicilios WHERE id = ? AND domiciliario_id = ?',
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

        // El domiciliario NO puede marcar como entregado con solo un botón:
        // necesita el código que el bot le mandó al cliente por WhatsApp.
        // Esto evita que se cierre un pedido que nunca llegó (robo o error).
        if (estado === 'entregado') {
            if (domicilio[0].codigo_confirmacion) {
                if (!codigo_confirmacion || String(codigo_confirmacion).trim() !== String(domicilio[0].codigo_confirmacion).trim()) {
                    return res.status(400).json({ error: 'Código de entrega incorrecto. Pídele al cliente el código que le llegó por WhatsApp.', codigo: 'CODIGO_INVALIDO' });
                }
            }

            const aTiempo = !domicilio[0].limite_entrega_at || new Date() <= new Date(domicilio[0].limite_entrega_at);
            if (aTiempo) {
                await db.execute(
                    'UPDATE domiciliarios SET score = LEAST(100, score + 2) WHERE id = ?',
                    [req.domiciliario.id]
                );
            } else {
                await db.execute(
                    'UPDATE domiciliarios SET score = GREATEST(0, score - 5), strikes = strikes + 1 WHERE id = ?',
                    [req.domiciliario.id]
                );
                await penalizarSiCorresponde(req.domiciliario.id, req.domiciliario.negocio_id);
            }
        }

        await db.execute(
            `UPDATE domicilios SET estado = ?, updated_at = NOW()${estado === 'entregado' ? ", estado_incidente = IF(estado_incidente = 'retrasado', 'resuelto', estado_incidente)" : ''} WHERE id = ?`,
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
                `SELECT dom.tracking_token, p.id as pedido_id, p.cliente_id, c.whatsapp as cliente_whatsapp
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

                // Automatización "resena": mismo criterio que en routes/pedidos.js,
                // para los pedidos que se entregan vía domiciliario en vez de
                // marcarse "entregado" directo desde el dashboard.
                pedirResenaSiCorresponde(req.domiciliario.negocio_id, domData[0].pedido_id, domData[0].cliente_whatsapp);
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
            `SELECT dom.estado, dom.created_at, dom.updated_at, dom.codigo_confirmacion, dom.ruta_coords,
                    dom.km_recorridos, dom.tiempo_minutos,
                    p.numero_pedido, p.total, p.direccion_entrega, p.direccion_lat, p.direccion_lng,
                    d.nombre as domiciliario_nombre, d.telefono as domiciliario_telefono,
                    d.latitud, d.longitud,
                    n.lat as negocio_lat, n.lng as negocio_lng, n.nombre as negocio_nombre
             FROM domicilios dom
             JOIN pedidos p ON dom.pedido_id = p.id
             JOIN negocios n ON dom.negocio_id = n.id
             LEFT JOIN domiciliarios d ON dom.domiciliario_id = d.id
             WHERE dom.tracking_token = ?`,
            [token]
        );

        if (domicilios.length === 0) {
            return res.status(404).json({ error: 'Seguimiento no encontrado' });
        }

        const fila = normalizarRuta(domicilios[0]);
        fila.negocio = fila.negocio_lat != null
            ? { lat: Number(fila.negocio_lat), lng: Number(fila.negocio_lng), nombre: fila.negocio_nombre }
            : null;
        delete fila.negocio_lat; delete fila.negocio_lng;

        res.json({ success: true, data: fila });
    } catch (error) {
        console.error('[Domicilios] Error tracking:', error);
        res.status(500).json({ error: 'Error al obtener seguimiento' });
    }
});

// El domiciliario reporta que algo salió mal (no encuentra la dirección, el
// cliente no contesta, sospecha de un intento de estafa, etc). Abre un
// incidente que el dueño del negocio resuelve desde el dashboard; mientras
// esté abierto, este domiciliario no puede tomar nuevos domicilios.
router.post('/driver/reportar-problema', verificarAuthDomiciliario, async (req, res) => {
    try {
        const { domicilio_id, motivo } = req.body;

        if (!domicilio_id) {
            return res.status(400).json({ error: 'domicilio_id requerido' });
        }

        const [domicilio] = await db.execute(
            'SELECT id FROM domicilios WHERE id = ? AND domiciliario_id = ?',
            [domicilio_id, req.domiciliario.id]
        );

        if (domicilio.length === 0) {
            return res.status(404).json({ error: 'Domicilio no encontrado' });
        }

        await db.execute(
            `UPDATE domicilios SET estado_incidente = 'en_disputa', updated_at = NOW() WHERE id = ?`,
            [domicilio_id]
        );

        await registrarNotificacion(
            req.domiciliario.negocio_id, 'domicilio_incidente',
            'Problema reportado en una entrega',
            `${req.domiciliario.nombre} reportó un problema: ${motivo || 'sin detalle'}`,
            domicilio_id
        );

        try {
            const { io } = require('../index');
            if (io) io.to(`negocio_${req.domiciliario.negocio_id}`).emit('domicilio_incidente', { domicilio_id, motivo });
        } catch (e) {}

        res.json({ success: true, message: 'Problema reportado, el negocio lo revisará pronto' });
    } catch (error) {
        console.error('[Domicilios] Error reportando problema:', error);
        res.status(500).json({ error: 'Error al reportar problema' });
    }
});

// Panel de incidentes para el dashboard: todo domicilio retrasado o en
// disputa que el dueño del negocio necesita revisar y resolver a mano.
router.get('/incidentes', verificarAuth, async (req, res) => {
    try {
        const [incidentes] = await db.execute(
            `SELECT dom.id, dom.estado, dom.estado_incidente, dom.limite_entrega_at, dom.created_at, dom.updated_at,
                    p.numero_pedido, p.direccion_entrega, p.total,
                    c.nombre as cliente_nombre, c.whatsapp as cliente_whatsapp,
                    d.id as domiciliario_id, d.nombre as domiciliario_nombre, d.telefono as domiciliario_telefono, d.score, d.strikes
             FROM domicilios dom
             JOIN pedidos p ON dom.pedido_id = p.id
             JOIN clientes c ON p.cliente_id = c.id
             LEFT JOIN domiciliarios d ON dom.domiciliario_id = d.id
             WHERE dom.negocio_id = ? AND dom.estado_incidente IN ('retrasado', 'en_disputa')
             ORDER BY dom.updated_at DESC`,
            [req.negocio.id]
        );

        res.json({ success: true, data: incidentes });
    } catch (error) {
        console.error('[Domicilios] Error listando incidentes:', error);
        res.status(500).json({ error: 'Error al listar incidentes' });
    }
});

// El dueño decide si el incidente fue un robo real (penaliza fuerte al
// domiciliario) o una falsa alarma (lo libera para seguir trabajando).
router.post('/incidentes/:id/resolver', verificarAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { resultado } = req.body; // 'robo_confirmado' | 'resuelto'

        if (!['robo_confirmado', 'resuelto'].includes(resultado)) {
            return res.status(400).json({ error: "resultado debe ser 'robo_confirmado' o 'resuelto'" });
        }

        const [domicilio] = await db.execute(
            'SELECT id, domiciliario_id FROM domicilios WHERE id = ? AND negocio_id = ?',
            [id, req.negocio.id]
        );

        if (domicilio.length === 0) {
            return res.status(404).json({ error: 'Domicilio no encontrado' });
        }

        await db.execute(
            `UPDATE domicilios SET estado_incidente = ?, updated_at = NOW() WHERE id = ?`,
            [resultado, id]
        );

        if (resultado === 'robo_confirmado' && domicilio[0].domiciliario_id) {
            await db.execute(
                'UPDATE domiciliarios SET score = GREATEST(0, score - 40), strikes = strikes + 1 WHERE id = ?',
                [domicilio[0].domiciliario_id]
            );
            await penalizarSiCorresponde(domicilio[0].domiciliario_id, req.negocio.id);
        }

        res.json({ success: true, message: resultado === 'robo_confirmado' ? 'Incidente marcado como robo, domiciliario penalizado' : 'Incidente resuelto' });
    } catch (error) {
        console.error('[Domicilios] Error resolviendo incidente:', error);
        res.status(500).json({ error: 'Error al resolver incidente' });
    }
});

router.post('/crear', verificarAuth, async (req, res) => {
    try {
        const { pedido_id, tarifa_envio } = req.body;

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
        const codigo_confirmacion = String(Math.floor(1000 + Math.random() * 9000));

        // Misma lógica que el bot: tarifa por km real si el negocio la configuró
        // (una tarifa_envio explícita en el body sigue mandando, por compatibilidad).
        let config = {};
        try {
            const [modulos] = await db.execute(
                `SELECT config FROM negocio_modulos WHERE negocio_id = ? AND modulo_name = 'domicilios'`,
                [req.negocio.id]
            );
            if (modulos.length > 0) {
                config = typeof modulos[0].config === 'string' ? JSON.parse(modulos[0].config) : (modulos[0].config || {});
            }
        } catch (e) { config = {}; }

        const cond = await calcularCondicionesDomicilio(req.negocio.id, pedido_id, config);
        const tarifaFinal = tarifa_envio !== undefined ? tarifa_envio : cond.tarifa;

        const [result] = await db.execute(
            `INSERT INTO domicilios (negocio_id, pedido_id, estado, tarifa_envio, km_recorridos, tiempo_minutos, ruta_coords, tracking_token, codigo_confirmacion)
             VALUES (?, ?, 'pendiente', ?, ?, ?, ?, ?, ?)`,
            [req.negocio.id, pedido_id, tarifaFinal, cond.km, cond.tiempo, cond.ruta_coords, tracking_token, codigo_confirmacion]
        );

        res.status(201).json({
            success: true,
            message: 'Domicilio creado para seguimiento',
            data: { id: result.insertId, tracking_token, codigo_confirmacion, tracking_url: `${TRACKING_BASE_URL}/${tracking_token}` }
        });
    } catch (error) {
        console.error('[Domicilios] Error creating domicilio:', error);
        res.status(500).json({ error: 'Error al crear domicilio' });
    }
});

module.exports = router;
