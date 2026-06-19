const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const { verificarAuth } = require('../middleware/auth');
const { injectTenantId, checkPlan, PLAN_LIMITS } = require('../middleware/tenant');

const router = express.Router();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'antigravity',
    waitForConnections: true,
    connectionLimit: 10
});

const JWT_SECRET = process.env.JWT_SECRET || 'antigravity_secret_key';

router.use(verificarAuth);

router.get('/perfil', async (req, res) => {
    try {
        const negocioId = req.negocio.id;

        const [negocios] = await pool.query(
            `SELECT id, nombre, color_principal, logo_url, whatsapp, email_dueno, 
                    nit, razon_social, tipo_negocio, ciudad, departamento, direccion, 
                    telefono, sitio_web, descripcion_negocio, numero_empleados, 
                    volumen_pedidos_dia, metodos_pago_activos, numero_nequi, 
                    numero_bancolombia, plan, onboarding_completado, onboarding_paso,
                    trial_hasta, suscripcion_activa, suscripcion_inicio, suscripcion_fin,
                    ultimo_login, created_at
             FROM negocios WHERE id = ?`,
            [negocioId]
        );

        if (negocios.length === 0) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        const negocio = negocios[0];
        
        if (negocio.metodos_pago_activos && typeof negocio.metodos_pago_activos === 'string') {
            try {
                negocio.metodos_pago_activos = JSON.parse(negocio.metodos_pago_activos);
            } catch (e) {
                negocio.metodos_pago_activos = [];
            }
        }

        res.json({ negocio });
    } catch (error) {
        console.error('[Business] Error getting perfil:', error);
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
});

router.put('/perfil', async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const camposPermitidos = [
            'nombre', 'color_principal', 'logo_url', 'whatsapp',
            'nit', 'razon_social', 'tipo_negocio', 'ciudad', 'departamento',
            'direccion', 'telefono', 'sitio_web', 'descripcion_negocio',
            'numero_empleados', 'volumen_pedidos_dia', 'metodos_pago_activos',
            'numero_nequi', 'numero_bancolombia'
        ];

        const updates = [];
        const values = [];

        for (const [key, value] of Object.entries(req.body)) {
            if (camposPermitidos.includes(key)) {
                if (key === 'metodos_pago_activos' && Array.isArray(value)) {
                    updates.push(`${key} = ?`);
                    values.push(JSON.stringify(value));
                } else if (value !== undefined) {
                    updates.push(`${key} = ?`);
                    values.push(value);
                }
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
        }

        values.push(negocioId);

        await pool.query(
            `UPDATE negocios SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        const [negocios] = await pool.query(
            'SELECT * FROM negocios WHERE id = ?',
            [negocioId]
        );

        res.json({ mensaje: 'Perfil actualizado', negocio: negocios[0] });
    } catch (error) {
        console.error('[Business] Error updating perfil:', error);
        res.status(500).json({ error: 'Error al actualizar perfil' });
    }
});

router.put('/password', async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const { passwordActual, passwordNueva } = req.body;

        if (!passwordActual || !passwordNueva) {
            return res.status(400).json({ error: 'Passwords requeridos' });
        }

        if (passwordNueva.length < 8) {
            return res.status(400).json({ error: 'Mínimo 8 caracteres' });
        }

        const [negocios] = await pool.query(
            'SELECT password FROM negocios WHERE id = ?',
            [negocioId]
        );

        if (negocios.length === 0) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        const passwordValida = await bcrypt.compare(passwordActual, negocios[0].password);
        if (!passwordValida) {
            return res.status(401).json({ error: 'Password actual incorrecto' });
        }

        const passwordHash = await bcrypt.hash(passwordNueva, 12);
        await pool.query(
            'UPDATE negocios SET password = ? WHERE id = ?',
            [passwordHash, negocioId]
        );

        res.json({ mensaje: 'Password actualizado correctamente' });
    } catch (error) {
        console.error('[Business] Error updating password:', error);
        res.status(500).json({ error: 'Error al actualizar password' });
    }
});

router.get('/plan', async (req, res) => {
    try {
        const negocioId = req.negocio.id;

        const [negocios] = await pool.query(
            'SELECT plan, suscripcion_activa, suscripcion_inicio, suscripcion_fin, trial_hasta FROM negocios WHERE id = ?',
            [negocioId]
        );

        if (negocios.length === 0) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        const negocio = negocios[0];
        
        const features = {
            starter: {
                nombre: 'Starter',
                precio: 450000,
                features: [
                    'Bot de ventas básico',
                    'Hasta 100 clientes',
                    'Catálogo de productos',
                    'Pedidos por WhatsApp',
                    'Reportes básicos',
                    'Soporte por email'
                ]
            },
            professional: {
                nombre: 'Professional',
                precio: 850000,
                features: [
                    'Todo de Starter',
                    'Clientes ilimitados',
                    'Analytics avanzado',
                    'Automatizaciones',
                    'Personalización completa',
                    'Múltiples métodos de pago',
                    'Soporte prioritario',
                    'API access'
                ]
            },
            enterprise: {
                nombre: 'Enterprise',
                precio: 1800000,
                features: [
                    'Todo de Professional',
                    'Multi-sede',
                    'Integraciones (Rappi/iFood)',
                    'OCR verificación de pagos',
                    'Equipo completo',
                    'Soporte 24/7',
                    'SLA garantizado',
                    'Implementación dedicada'
                ]
            }
        };

        res.json({
            plan: {
                tipo: negocio.plan,
                activo: negocio.suscripcion_activa,
                inicio: negocio.suscripcion_inicio,
                fin: negocio.suscripcion_fin,
                trial_hasta: negocio.trial_hasta,
                ...features[negocio.plan]
            },
            features
        });
    } catch (error) {
        console.error('[Business] Error getting plan:', error);
        res.status(500).json({ error: 'Error al obtener plan' });
    }
});

router.put('/onboarding/:paso', async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const paso = parseInt(req.params.paso);

        if (isNaN(paso) || paso < 1 || paso > 5) {
            return res.status(400).json({ error: 'Paso inválido' });
        }

        const datosPaso = req.body;

        const [existing] = await pool.query(
            'SELECT * FROM onboarding_progress WHERE negocio_id = ?',
            [negocioId]
        );

        let datosAnteriores = {};
        if (existing.length > 0 && existing[0].datos_paso) {
            try {
                datosAnteriores = typeof existing[0].datos_paso === 'string' 
                    ? JSON.parse(existing[0].datos_paso) 
                    : existing[0].datos_paso;
            } catch (e) {
                datosAnteriores = {};
            }
        }

        datosAnteriores[`paso${paso}`] = datosPaso;

        if (existing.length === 0) {
            await pool.query(
                'INSERT INTO onboarding_progress (negocio_id, paso_actual, datos_paso, completado) VALUES (?, ?, ?, false)',
                [negocioId, paso, JSON.stringify(datosAnteriores)]
            );
        } else {
            await pool.query(
                'UPDATE onboarding_progress SET paso_actual = ?, datos_paso = ?, updated_at = NOW() WHERE negocio_id = ?',
                [paso, JSON.stringify(datosAnteriores), negocioId]
            );
        }

        const updatesNegocios = [];
        const valuesNegocios = [];

        if (paso === 2) {
            if (datosPaso.nombre_comercial) {
                updatesNegocios.push('nombre = ?');
                valuesNegocios.push(datosPaso.nombre_comercial);
            }
            if (datosPaso.razon_social) {
                updatesNegocios.push('razon_social = ?');
                valuesNegocios.push(datosPaso.razon_social);
            }
            if (datosPaso.nit) {
                updatesNegocios.push('nit = ?');
                valuesNegocios.push(datosPaso.nit);
            }
            if (datosPaso.tipo_negocio) {
                updatesNegocios.push('tipo_negocio = ?');
                valuesNegocios.push(datosPaso.tipo_negocio);
            }
            if (datosPaso.descripcion) {
                updatesNegocios.push('descripcion_negocio = ?');
                valuesNegocios.push(datosPaso.descripcion);
            }
            if (datosPaso.ciudad) {
                updatesNegocios.push('ciudad = ?');
                valuesNegocios.push(datosPaso.ciudad);
            }
            if (datosPaso.departamento) {
                updatesNegocios.push('departamento = ?');
                valuesNegocios.push(datosPaso.departamento);
            }
            if (datosPaso.direccion) {
                updatesNegocios.push('direccion = ?');
                valuesNegocios.push(datosPaso.direccion);
            }
            if (datosPaso.telefono) {
                updatesNegocios.push('telefono = ?');
                valuesNegocios.push(datosPaso.telefono);
            }
            if (datosPaso.sitio_web) {
                updatesNegocios.push('sitio_web = ?');
                valuesNegocios.push(datosPaso.sitio_web);
            }
        }

        if (paso === 3) {
            if (datosPaso.numero_empleados) {
                updatesNegocios.push('numero_empleados = ?');
                valuesNegocios.push(datosPaso.numero_empleados);
            }
            if (datosPaso.volumen_pedidos) {
                updatesNegocios.push('volumen_pedidos_dia = ?');
                valuesNegocios.push(datosPaso.volumen_pedidos);
            }
            if (datosPaso.metodos_pago) {
                updatesNegocios.push('metodos_pago_activos = ?');
                valuesNegocios.push(JSON.stringify(datosPaso.metodos_pago));
            }
            if (datosPaso.numero_nequi) {
                updatesNegocios.push('numero_nequi = ?');
                valuesNegocios.push(datosPaso.numero_nequi);
            }
            if (datosPaso.numero_bancolombia) {
                updatesNegocios.push('numero_bancolombia = ?');
                valuesNegocios.push(datosPaso.numero_bancolombia);
            }
        }

        if (paso === 4) {
            if (datosPaso.plan) {
                updatesNegocios.push('plan = ?');
                valuesNegocios.push(datosPaso.plan);
            }
        }

        if (paso === 5) {
            updatesNegocios.push('onboarding_completado = ?');
            valuesNegocios.push(true);
            updatesNegocios.push('terminos_aceptados = ?');
            valuesNegocios.push(true);
            updatesNegocios.push('terminos_fecha = NOW()');
        }

        if (updatesNegocios.length > 0) {
            valuesNegocios.push(negocioId);
            
            const query = updatesNegocios.join(', ');
            await pool.query(
                `UPDATE negocios SET ${query} WHERE id = ?`,
                valuesNegocios
            );
        }

        res.json({
            mensaje: `Paso ${paso} guardado`,
            paso_actual: paso,
            completado: paso === 5
        });

    } catch (error) {
        console.error('[Business] Error saving onboarding:', error);
        res.status(500).json({ error: 'Error al guardar progreso' });
    }
});

router.get('/onboarding', async (req, res) => {
    try {
        const negocioId = req.negocio.id;

        const [progress] = await pool.query(
            'SELECT * FROM onboarding_progress WHERE negocio_id = ?',
            [negocioId]
        );

        if (progress.length === 0) {
            return res.json({
                paso_actual: 1,
                datos: {},
                completado: false
            });
        }

        let datos = {};
        try {
            datos = typeof progress[0].datos_paso === 'string'
                ? JSON.parse(progress[0].datos_paso)
                : progress[0].datos_paso;
        } catch (e) {
            datos = {};
        }

        res.json({
            paso_actual: progress[0].paso_actual,
            datos,
            completado: progress[0].completado
        });
    } catch (error) {
        console.error('[Business] Error getting onboarding:', error);
        res.status(500).json({ error: 'Error al obtener progreso' });
    }
});

router.get('/whatsapp/status', async (req, res) => {
    try {
        const negocioId = req.negocio.id;

        const [negocios] = await pool.query(
            'SELECT whatsapp_conectado, numero_whatsapp, whatsapp_ultima_conexion FROM negocios WHERE id = ?',
            [negocioId]
        );

        if (negocios.length === 0) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        let qrBase64 = null;
        let instanceStatus = { connected: false };

        try {
            const instanceManager = require('../../instance-manager/InstanceManager');
            instanceStatus = instanceManager.getStatus(negocioId);
            if (instanceStatus.qr) {
                qrBase64 = instanceStatus.qr;
            }
        } catch (e) {
            console.error('[WhatsApp Status] Error:', e.message);
        }

        res.json({
            conectado: negocios[0].whatsapp_conectado || instanceStatus.connected,
            numero: negocios[0].numero_whatsapp || instanceStatus.phone,
            ultimo_ping: negocios[0].whatsapp_ultima_conexion,
            qr_base64: qrBase64
        });
    } catch (error) {
        console.error('[WhatsApp Status] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener estado de WhatsApp' });
    }
});

router.post('/whatsapp/connect', async (req, res) => {
    try {
        const negocioId = req.negocio.id;

        try {
            const instanceManager = require('../../instance-manager/InstanceManager');
            await instanceManager.startInstance(negocioId);
            
            res.json({
                success: true,
                mensaje: 'Bot de WhatsApp iniciando...',
                estado: 'conectando'
            });
        } catch (e) {
            if (e.message.includes('no encontrado')) {
                const [negocios] = await pool.query(
                    'SELECT * FROM negocios WHERE id = ?',
                    [negocioId]
                );
                
                if (negocios.length > 0) {
                    await pool.query(
                        'UPDATE negocios SET whatsapp_conectado = true WHERE id = ?',
                        [negocioId]
                    );
                }
            }
            throw e;
        }
    } catch (error) {
        console.error('[WhatsApp Connect] Error:', error.message);
        res.status(500).json({ error: 'Error al conectar WhatsApp' });
    }
});

router.post('/whatsapp/disconnect', async (req, res) => {
    try {
        const negocioId = req.negocio.id;

        try {
            const instanceManager = require('../../instance-manager/InstanceManager');
            await instanceManager.stopInstance(negocioId);
        } catch (e) {
            console.log('[WhatsApp Disconnect] Instancia no encontrada, actualizando BD');
        }

        await pool.query(
            'UPDATE negocios SET whatsapp_conectado = false WHERE id = ?',
            [negocioId]
        );

        res.json({
            success: true,
            mensaje: 'WhatsApp desconectado'
        });
    } catch (error) {
        console.error('[WhatsApp Disconnect] Error:', error.message);
        res.status(500).json({ error: 'Error al desconectar WhatsApp' });
    }
});

router.put('/whatsapp/config', async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const { bot_nombre, bot_tono, bot_bienvenida, horario_activo_inicio, horario_activo_fin, mensaje_fuera_horario } = req.body;

        const updates = [];
        const values = [];

        if (bot_nombre !== undefined) {
            updates.push('bot_nombre = ?');
            values.push(bot_nombre);
        }
        if (bot_tono !== undefined) {
            updates.push('bot_tono = ?');
            values.push(bot_tono);
        }
        if (bot_bienvenida !== undefined) {
            updates.push('bot_bienvenida = ?');
            values.push(bot_bienvenida);
        }
        if (horario_activo_inicio !== undefined) {
            updates.push('horario_activo_inicio = ?');
            values.push(horario_activo_inicio);
        }
        if (horario_activo_fin !== undefined) {
            updates.push('horario_activo_fin = ?');
            values.push(horario_activo_fin);
        }
        if (mensaje_fuera_horario !== undefined) {
            updates.push('mensaje_fuera_horario = ?');
            values.push(mensaje_fuera_horario);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        values.push(negocioId);

        await pool.query(
            `UPDATE negocios SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        res.json({ success: true, mensaje: 'Configuración actualizada' });
    } catch (error) {
        console.error('[WhatsApp Config] Error:', error.message);
        res.status(500).json({ error: 'Error al guardar configuración' });
    }
});

router.post('/plan/upgrade', checkPlan('starter'), async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const { nuevoPlan } = req.body;

        if (!['starter', 'professional', 'enterprise'].includes(nuevoPlan)) {
            return res.status(400).json({ error: 'Plan inválido' });
        }

        const planOrden = { starter: 1, professional: 2, enterprise: 3 };
        if (planOrden[nuevoPlan] <= planOrden[req.negocio.plan]) {
            return res.status(400).json({ error: 'Ya tienes este plan o uno superior' });
        }

        await pool.query(
            `UPDATE negocios SET 
                plan = ?,
                suscripcion_activa = true,
                suscripcion_inicio = NOW(),
                suscripcion_fin = DATE_ADD(NOW(), INTERVAL 1 MONTH)
             WHERE id = ?`,
            [nuevoPlan, negocioId]
        );

        const [suscripciones] = await pool.query(
            'SELECT * FROM suscripciones WHERE negocio_id = ? ORDER BY created_at DESC LIMIT 1',
            [negocioId]
        );

        if (suscripciones.length > 0) {
            await pool.query(
                `UPDATE suscripciones SET 
                    plan = ?,
                    estado = 'activa',
                    pago_inicio = NOW(),
                    pago_fin = DATE_ADD(NOW(), INTERVAL 1 MONTH)
                 WHERE id = ?`,
                [nuevoPlan, suscripciones[0].id]
            );
        } else {
            await pool.query(
                `INSERT INTO suscripciones 
                    (negocio_id, plan, estado, pago_inicio, pago_fin, monto_mensual) 
                 VALUES (?, ?, 'activa', NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH), ?)`,
                [negocioId, nuevoPlan, nuevoPlan === 'professional' ? 249000 : 499000]
            );
        }

        res.json({
            success: true,
            mensaje: `Plan actualizado a ${nuevoPlan}`,
            nuevo_plan: nuevoPlan
        });
    } catch (error) {
        console.error('[Plan Upgrade] Error:', error.message);
        res.status(500).json({ error: 'Error al actualizar plan' });
    }
});

module.exports = router;
