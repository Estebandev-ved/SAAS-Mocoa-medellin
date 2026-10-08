const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');
const { checkPlan } = require('../middleware/tenant');
const { sanitizeAvatar, parseAvatar } = require('../services/avatar');
const { sanitizeVistos, parseVistos } = require('../services/uiEstado');
const { getPlan, getPlanFeatures, checkLimit, getNextPlan, getPlanPrice, getIncludedFeatureLabels, getUpgradeBenefits, getAllPlans } = require('../../config/planConfig');

// Router canónico para /api/business (antes montado en /api/negocio, que
// ningún cliente llamaba — el frontend siempre pegó a /api/business/*).
// Usa el pool de conexión y el middleware de auth compartidos en vez de los
// propios que tenía este archivo (pool de MySQL duplicado, JWT_SECRET con
// valor por defecto hardcodeado).
const router = express.Router();

router.use(verificarAuth);

// Avatar del dueño (personaje personalizable). Siempre se valida contra lista blanca.
router.get('/avatar', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT avatar_config FROM negocios WHERE id = ?', [req.negocio.id]);
        res.json({ avatar: parseAvatar(rows[0] && rows[0].avatar_config) });
    } catch (error) {
        console.error('[Business] Error getting avatar:', error);
        res.status(500).json({ error: 'Error al obtener el avatar' });
    }
});

router.put('/avatar', async (req, res) => {
    try {
        const avatar = sanitizeAvatar(req.body && req.body.avatar);
        await db.execute('UPDATE negocios SET avatar_config = ? WHERE id = ?', [JSON.stringify(avatar), req.negocio.id]);
        res.json({ avatar });
    } catch (error) {
        console.error('[Business] Error saving avatar:', error);
        res.status(500).json({ error: 'Error al guardar el avatar' });
    }
});

// Logros y consejos de los personajes que el panel ya mostró (para no repetirlos al cambiar de navegador).
// PUT une lo enviado con lo guardado: nunca se pierde un "visto" por escribir desde otro dispositivo.
router.get('/ui-estado', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT ui_estado FROM negocios WHERE id = ?', [req.negocio.id]);
        res.json({ vistos: parseVistos(rows[0] && rows[0].ui_estado) });
    } catch (error) {
        console.error('[Business] Error getting ui-estado:', error);
        res.status(500).json({ error: 'Error al obtener el estado de la interfaz' });
    }
});

router.put('/ui-estado', async (req, res) => {
    try {
        const nuevos = sanitizeVistos(req.body && req.body.vistos);
        const [rows] = await db.execute('SELECT ui_estado FROM negocios WHERE id = ?', [req.negocio.id]);
        const vistos = sanitizeVistos([...parseVistos(rows[0] && rows[0].ui_estado), ...nuevos]);
        await db.execute('UPDATE negocios SET ui_estado = ? WHERE id = ?', [JSON.stringify({ vistos }), req.negocio.id]);
        res.json({ vistos });
    } catch (error) {
        console.error('[Business] Error saving ui-estado:', error);
        res.status(500).json({ error: 'Error al guardar el estado de la interfaz' });
    }
});

router.get('/perfil', async (req, res) => {
    try {
        const negocioId = req.negocio.id;

        const [negocios] = await db.execute(
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

        // Si cambió la dirección o la ciudad, las coordenadas guardadas (lat/lng)
        // quedan obsoletas y apuntando al punto viejo — obtenerOrigenNegocio() las
        // reutiliza como "origen" de todos los domicilios de este negocio sin
        // volver a geocodificar mientras existan. Sin este reseteo, un negocio
        // que se muda o corrige su dirección seguiría mandando domiciliarios al
        // punto anterior para siempre (y calculando mal la tarifa por km).
        if (updates.some((u) => u.startsWith('direccion') || u.startsWith('ciudad'))) {
            updates.push('lat = NULL', 'lng = NULL');
        }

        values.push(negocioId);

        await db.execute(
            `UPDATE negocios SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        const [negocios] = await db.execute(
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
        const passwordActual = req.body.passwordActual;
        // El frontend manda "passwordNuevo" (con typo); toleramos ambas formas.
        const passwordNueva = req.body.passwordNueva || req.body.passwordNuevo;

        if (!passwordActual || !passwordNueva) {
            return res.status(400).json({ error: 'Passwords requeridos' });
        }

        if (passwordNueva.length < 8) {
            return res.status(400).json({ error: 'Mínimo 8 caracteres' });
        }

        const [negocios] = await db.execute(
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
        await db.execute(
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

        const [negocios] = await db.execute(
            'SELECT plan, suscripcion_activa, suscripcion_inicio, suscripcion_fin, trial_hasta FROM negocios WHERE id = ?',
            [negocioId]
        );

        if (negocios.length === 0) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        const negocio = negocios[0];
        const plan = negocio.plan || 'starter';
        const planInfo = getPlan(plan);

        // Uso real del mes en curso — siempre en vivo desde las tablas
        // operativas (agente_logs, clientes, productos), nunca de una tabla
        // de caché aparte que se pueda quedar desactualizada. mensajes
        // incluye TODOS los canales (WhatsApp y llamadas), porque
        // orchestrator.js registra el mismo `agente_logs` sin importar el
        // canal de origen.
        const periodo = new Date().toISOString().substring(0, 7);
        const [[mensajesStats], [clientesStats], [productosStats]] = await Promise.all([
            db.execute(
                `SELECT COUNT(*) as total FROM agente_logs
                 WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
                [negocioId, periodo]
            ),
            db.execute(
                `SELECT COUNT(*) as total FROM clientes
                 WHERE negocio_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = ?`,
                [negocioId, periodo]
            ),
            db.execute(
                `SELECT COUNT(*) as total FROM productos WHERE negocio_id = ?`,
                [negocioId]
            ),
        ]);

        const mensajesUsados = mensajesStats[0]?.total || 0;
        const clientesNuevos = clientesStats[0]?.total || 0;
        const productosCreados = productosStats[0]?.total || 0;

        const now = new Date();
        // Prueba gratis: cuentas nuevas quedan con suscripcion_activa=1 y fin a 7 días (sin suscripcion_inicio, que solo fija un pago)
        const enTrial = !!(negocio.trial_hasta && new Date(negocio.trial_hasta) > now && !negocio.suscripcion_inicio);
        const diasTrialRestantes = negocio.trial_hasta
            ? Math.max(0, Math.ceil((new Date(negocio.trial_hasta) - now) / (1000 * 60 * 60 * 24)))
            : 0;

        const usoMensajes = checkLimit(plan, 'maxMessages', mensajesUsados);
        const usoClientes = checkLimit(plan, 'maxClients', clientesNuevos);
        const usoProductos = checkLimit(plan, 'maxProducts', productosCreados);

        // Aversión a la pérdida: en vez de mostrar solo "lo que ganas" al
        // subir de plan, usamos el uso real de este mes para mostrar también
        // lo que se está dejando sobre la mesa si no se sube. Solo aparece
        // cuando el uso ya pesa (>=70%) para no generar ruido en negocios que
        // apenas están empezando — ver guía de pricing psicológico en el
        // proyecto de Claude.
        const upgradeBenefits = getUpgradeBenefits(plan);
        if (upgradeBenefits) {
            const perdidaPotencial = [];
            if (usoMensajes.limit !== -1) {
                if (usoMensajes.percentage >= 100) {
                    perdidaPotencial.push(`Ya usaste el 100% de tus ${usoMensajes.limit} mensajes de IA este mes — el bot puede dejar de responder pedidos por WhatsApp hasta tu próximo ciclo.`);
                } else if (usoMensajes.percentage >= 70) {
                    perdidaPotencial.push(`Ya usaste ${usoMensajes.percentage}% de tus ${usoMensajes.limit} mensajes de IA este mes.`);
                }
            }
            if (usoClientes.limit !== -1 && usoClientes.percentage >= 70) {
                perdidaPotencial.push(`Llevas ${usoClientes.usage} de ${usoClientes.limit} clientes nuevos permitidos este mes.`);
            }
            if (usoProductos.limit !== -1 && usoProductos.percentage >= 70) {
                perdidaPotencial.push(`Tu catálogo tiene ${usoProductos.usage} de ${usoProductos.limit} productos permitidos.`);
            }
            upgradeBenefits.perdida_potencial = perdidaPotencial;
        }

        res.json({
            plan: {
                tipo: plan,
                nombre: planInfo.nameEs,
                precio: planInfo.price,
                activo: negocio.suscripcion_activa,
                inicio: negocio.suscripcion_inicio,
                fin: negocio.suscripcion_fin,
                trial_hasta: negocio.trial_hasta,
                en_trial: enTrial,
                dias_trial_restantes: diasTrialRestantes,
                features_incluidas: getIncludedFeatureLabels(plan),
                uso: {
                    mensajes: usoMensajes,
                    clientes: usoClientes,
                    productos: usoProductos,
                },
                // Compatibilidad con quien ya leía estos dos campos sueltos
                mensajes_usados: mensajesUsados,
                limite_mensajes: getPlanFeatures(plan).maxMessages,
            },
            // Si ya está en el plan más alto, no hay nada que ofrecer.
            upgrade_disponible: upgradeBenefits,
            // Tabla completa de los 3 planes (anclaje + decoy): el dashboard
            // las muestra lado a lado, con el plan `popular` resaltado como
            // "Más elegido" para dirigir la decisión sin ocultar las otras
            // opciones — la más cara sirve de referencia para que el plan
            // recomendado se vea razonable.
            planes: getAllPlans().map(p => ({
                id: p.id,
                nombre: p.nameEs,
                precio: p.price,
                popular: p.popular,
                features_incluidas: getIncludedFeatureLabels(p.id),
            })),
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

        const [existing] = await db.execute(
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
            await db.execute(
                'INSERT INTO onboarding_progress (negocio_id, paso_actual, datos_paso, completado) VALUES (?, ?, ?, false)',
                [negocioId, paso, JSON.stringify(datosAnteriores)]
            );
        } else {
            await db.execute(
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

        // Mismo caso que en PUT /perfil: si esta vez el onboarding trajo dirección
        // o ciudad, las coordenadas cacheadas quedan obsoletas.
        if (updatesNegocios.some((u) => u.startsWith('direccion') || u.startsWith('ciudad'))) {
            updatesNegocios.push('lat = NULL', 'lng = NULL');
        }

        if (updatesNegocios.length > 0) {
            valuesNegocios.push(negocioId);

            const query = updatesNegocios.join(', ');
            await db.execute(
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

        const [progress] = await db.execute(
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

        const [negocios] = await db.execute(
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
                const [negocios] = await db.execute(
                    'SELECT * FROM negocios WHERE id = ?',
                    [negocioId]
                );
                
                if (negocios.length > 0) {
                    await db.execute(
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

        await db.execute(
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
        const { bot_nombre, bot_tono, horario_activo_inicio, horario_activo_fin, mensaje_fuera_horario } = req.body;

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

        await db.execute(
            `UPDATE negocios SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        res.json({ success: true, mensaje: 'Configuración actualizada' });
    } catch (error) {
        console.error('[WhatsApp Config] Error:', error.message);
        res.status(500).json({ error: 'Error al guardar configuración' });
    }
});

// Antes esta ruta activaba cualquier plan sin cobrar nada (bastaba estar
// autenticado). Los cambios de plan pasan ahora por /api/stripe/checkout, que
// solo activa el plan cuando hay un pago (o un pago de prueba en desarrollo).
router.post('/plan/upgrade', (req, res) => {
    res.status(410).json({
        error: 'Esta ruta ya no existe. Cambia de plan desde Suscripción.',
        usar: 'POST /api/stripe/checkout',
    });
});

// Plantillas de onboarding por vertical: al terminar el registro, precarga
// mensajes del bot y un catálogo demo según el tipo de negocio (paso 2 del
// wizard de registro). Antes de esto un negocio nuevo arrancaba con el
// dashboard completamente vacío — sin productos, sin mensaje de bienvenida
// propio — lo que es más fricción para alguien no técnico en la primera
// sesión. Solo agrega productos si el negocio todavía no tiene ninguno
// (para no duplicar catálogo si se llama más de una vez).
const PLANTILLAS_VERTICAL = {
    restaurante: {
        bot_bienvenida: '¡Hola! 👋 Bienvenido a {nombre}. Escríbeme lo que se te antoje y te ayudo a hacer tu pedido.',
        mensaje_fuera_horario: 'Gracias por escribir. En este momento estamos cerrados, pero apenas abramos te respondemos.',
        productos: [
            { nombre: 'Plato del día', descripcion: 'Pregunta por la opción de hoy', precio: 18000, stock: 50 },
            { nombre: 'Jugo natural', descripcion: 'Elige tu fruta favorita', precio: 6000, stock: 100 },
            { nombre: 'Postre de la casa', descripcion: '', precio: 8000, stock: 30 }
        ]
    },
    retail: {
        bot_bienvenida: '¡Hola! 👋 Bienvenido a {nombre}. Cuéntame qué buscas y te muestro lo que tenemos disponible.',
        mensaje_fuera_horario: 'Gracias por escribir. Estamos fuera de horario de atención, te respondemos apenas abramos.',
        productos: [
            { nombre: 'Producto destacado', descripcion: 'Edita este producto con tu catálogo real', precio: 25000, stock: 20 },
            { nombre: 'Combo/Promo', descripcion: '', precio: 40000, stock: 15 }
        ]
    },
    servicios: {
        bot_bienvenida: '¡Hola! 👋 Bienvenido a {nombre}. Cuéntame qué servicio necesitas y te ayudo a agendar.',
        mensaje_fuera_horario: 'Gracias por escribir. Estamos fuera de horario, te confirmamos tu cita apenas abramos.',
        productos: [
            { nombre: 'Servicio básico', descripcion: 'Edita con tus servicios reales y precios', precio: 30000, stock: 999 },
            { nombre: 'Servicio premium', descripcion: '', precio: 60000, stock: 999 }
        ]
    }
};

router.post('/plantilla', async (req, res) => {
    try {
        const negocioId = req.negocio.id;
        const plantilla = PLANTILLAS_VERTICAL[req.body.tipo_negocio];

        if (!plantilla) {
            // No hay plantilla específica (ej. salud, inmobiliaria, educacion,
            // otro) — no es un error, simplemente no hay nada que precargar
            // todavía para ese tipo de negocio.
            return res.json({ success: true, aplicada: false });
        }

        const [negocios] = await db.execute('SELECT nombre FROM negocios WHERE id = ?', [negocioId]);
        const nombreNegocio = negocios[0]?.nombre || 'tu negocio';

        await db.execute(
            'UPDATE negocios SET bot_bienvenida = ?, mensaje_fuera_horario = ? WHERE id = ?',
            [plantilla.bot_bienvenida.replace('{nombre}', nombreNegocio), plantilla.mensaje_fuera_horario, negocioId]
        );

        const [existentes] = await db.execute('SELECT COUNT(*) as total FROM productos WHERE negocio_id = ?', [negocioId]);
        let productosCreados = 0;
        if (existentes[0].total === 0) {
            for (const producto of plantilla.productos) {
                await db.execute(
                    'INSERT INTO productos (negocio_id, nombre, descripcion, precio, stock, activo) VALUES (?, ?, ?, ?, ?, true)',
                    [negocioId, producto.nombre, producto.descripcion || null, producto.precio, producto.stock]
                );
                productosCreados++;
            }
        }

        res.json({ success: true, aplicada: true, productos_creados: productosCreados });
    } catch (error) {
        console.error('[Business] Error aplicando plantilla:', error.message);
        res.status(500).json({ error: 'Error al aplicar plantilla de onboarding' });
    }
});

module.exports = router;
