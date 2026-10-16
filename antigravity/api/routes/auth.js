const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../../db/config');
const { sanitizeAvatar, parseAvatar } = require('../services/avatar');
const { validarPassword, huellaPassword } = require('../services/passwordPolicy');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

const { body, validationResult } = require('express-validator');
const { loginRateLimit, passwordResetRateLimit, sanitizeLog, blacklistToken, checkBlacklist } = require('../middleware/security');

function getClientIP(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

// Envía un correo de seguridad sin que un fallo del SMTP rompa la petición.
async function avisarPorCorreo(tipo, email, data) {
    try {
        const { sendEmail } = require('../../queue/workers/emailWorker');
        await sendEmail(tipo, email, data);
    } catch (e) {
        console.error(`[Auth] No se pudo enviar el correo "${tipo}":`, e.message);
    }
}

function firmarToken(negocio, extra = {}) {
    return jwt.sign(
        { negocio_id: negocio.id, email: negocio.email_dueno, plan: negocio.plan, nombre: negocio.nombre, pv: huellaPassword(negocio.password), ...extra },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// Lee el avatar guardado. Tolerante: si la migración (avatar_config) aún no se corrió, devuelve null.
async function leerAvatar(negocioId) {
    try {
        const [rows] = await pool.query('SELECT avatar_config FROM negocios WHERE id = ?', [negocioId]);
        return parseAvatar(rows[0] && rows[0].avatar_config);
    } catch (e) {
        return null;
    }
}

router.post('/registro', [
    body('email_dueno').isEmail().withMessage('Debe ser un correo electrónico válido').normalizeEmail(),
    body('password').custom((v, { req }) => {
        const error = validarPassword(v, { email: req.body.email_dueno });
        if (error) throw new Error(error);
        return true;
    }),
    body('nombre').trim().notEmpty().withMessage('El nombre es requerido'),
    body('whatsapp').optional({ checkFalsy: true }).trim().isLength({ min: 7, max: 20 }).withMessage('El número de WhatsApp debe tener entre 7 y 20 caracteres')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { email_dueno, password, nombre, whatsapp, terminos_aceptados } = req.body;

        const [existente] = await pool.query(
            'SELECT id FROM negocios WHERE email_dueno = ?',
            [email_dueno]
        );

        if (existente.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        const bcrypt = require('bcryptjs');
        const passwordHash = bcrypt.hashSync(password, 12);
        // La prueba de 7 días NO empieza al registrarse: empieza la primera vez que el negocio
        // conecta su WhatsApp (ver InstanceManager.markConnected). Hasta entonces suscripcion_fin queda en NULL.

        const [result] = await pool.query(
            `INSERT INTO negocios (nombre, email_dueno, whatsapp, password, plan, suscripcion_fin, suscripcion_activa, terminos_aceptados, terminos_fecha, color_principal) 
             VALUES (?, ?, ?, ?, 'starter', ?, true, ?, NOW(), '#00D9FF')`,
            [nombre, email_dueno, whatsapp, passwordHash, null, terminos_aceptados || false]
        );

        // Avatar elegido en el registro (opcional). Se valida contra lista blanca antes de guardarlo.
        let avatar = null;
        if (req.body.avatar) {
            avatar = sanitizeAvatar(req.body.avatar);
            try {
                await pool.query('UPDATE negocios SET avatar_config = ? WHERE id = ?', [JSON.stringify(avatar), result.insertId]);
            } catch (e) {
                console.error('[Auth] No se pudo guardar el avatar (¿migración pendiente?):', e.message);
                avatar = null;
            }
        }

        const token = firmarToken({ id: result.insertId, email_dueno, plan: 'starter', nombre, password: passwordHash });

        res.status(201).json({
            token,
            mensaje: 'Cuenta creada',
            negocio: {
                id: result.insertId,
                nombre,
                email: email_dueno,
                plan: 'starter',
                color_principal: '#00D9FF',
                onboarding_completado: false,
                avatar
            }
        });

    } catch (error) {
        console.error('[Auth] Error en registro:', error);
        res.status(500).json({ error: 'Error al crear la cuenta' });
    }
});

router.post('/login', [
    loginRateLimit,
    body('email').isEmail().withMessage('Debe ser un correo electrónico válido').normalizeEmail(),
    body('password').notEmpty().withMessage('La contraseña es requerida')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
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

        if (negocio.cuenta_bloqueada) {
            return res.status(403).json({ error: 'Cuenta bloqueada por demasiados intentos. Usa "Olvidé mi contraseña" para recuperarla.', codigo: 'CUENTA_BLOQUEADA' });
        }

        // Verify password with bcrypt
        let passwordValida = false;
        if (negocio.password) {
            const bcrypt = require('bcryptjs');
            passwordValida = bcrypt.compareSync(password, negocio.password);
        }

        if (!passwordValida) {
            const nuevosIntentos = (negocio.intentos_login_fallidos || 0) + 1;
            
            if (nuevosIntentos >= 5) {
                await pool.query(
                    'UPDATE negocios SET intentos_login_fallidos = ?, cuenta_bloqueada = true WHERE id = ?',
                    [nuevosIntentos, negocio.id]
                );
                avisarPorCorreo('cuenta_bloqueada', negocio.email_dueno, {
                    mensaje: 'Bloqueamos tu cuenta tras 5 intentos fallidos de inicio de sesión. Si fuiste tú, usa "Olvidé mi contraseña" para recuperarla. Si no fuiste tú, hazlo igual y elige una contraseña nueva.'
                });
                return res.status(403).json({ error: 'Cuenta bloqueada por demasiados intentos. Usa "Olvidé mi contraseña" para recuperarla.', codigo: 'CUENTA_BLOQUEADA' });
            }

            await pool.query(
                'UPDATE negocios SET intentos_login_fallidos = ? WHERE id = ?',
                [nuevosIntentos, negocio.id]
            );

            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        await pool.query(
            'UPDATE negocios SET intentos_login_fallidos = 0, ultimo_login = NOW() WHERE id = ?',
            [negocio.id]
        );

        const [modulos] = await pool.query(
            'SELECT modulo_name FROM negocio_modulos WHERE negocio_id = ? AND activo = true',
            [negocio.id]
        );
        const modulosActivos = modulos.map(m => m.modulo_name);

        const token = firmarToken(negocio, { rol: negocio.rol || 'negocio' });

        res.json({
            token,
            negocio: {
                id: negocio.id,
                nombre: negocio.nombre,
                email: negocio.email_dueno,
                plan: negocio.plan,
                rol: negocio.rol || 'negocio',
                color_principal: negocio.color_principal || '#00D9FF',
                logo_url: negocio.logo_url,
                onboarding_completado: Boolean(negocio.onboarding_completado),
                trial_hasta: negocio.trial_hasta,
                suscripcion_activa: Boolean(negocio.suscripcion_activa),
                modulos_activos: modulosActivos,
                avatar: parseAvatar(negocio.avatar_config)
            }
        });

    } catch (error) {
        console.error('[Auth] Error en login:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

router.post('/logout', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const decoded = jwt.decode(token);
                if (decoded && decoded.exp) {
                    await blacklistToken(token, decoded.exp);
                }
            } catch (err) {
                console.error('[Auth] Error al decodificar token para blacklist:', err);
            }
        }
        res.json({ mensaje: 'Sesión cerrada' });
    } catch (error) {
        res.status(500).json({ error: 'Error al cerrar sesión' });
    }
});

router.get('/verify', checkBlacklist, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token requerido' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);

        const [negocios] = await pool.query(
            'SELECT id, nombre, email_dueno, plan, color_principal, logo_url, onboarding_completado, trial_hasta, suscripcion_activa, rol FROM negocios WHERE id = ?',
            [decoded.negocio_id]
        );

        if (negocios.length === 0) {
            return res.status(401).json({ error: 'Negocio no encontrado' });
        }

        const negocio = negocios[0];

        const [modulos] = await pool.query(
            'SELECT modulo_name FROM negocio_modulos WHERE negocio_id = ? AND activo = true',
            [negocio.id]
        );
        const modulosActivos = modulos.map(m => m.modulo_name);

        res.json({
            negocio: {
                id: negocio.id,
                nombre: negocio.nombre,
                email: negocio.email_dueno,
                plan: negocio.plan,
                rol: negocio.rol || 'negocio',
                color_principal: negocio.color_principal,
                logo_url: negocio.logo_url,
                onboarding_completado: Boolean(negocio.onboarding_completado),
                trial_hasta: negocio.trial_hasta,
                suscripcion_activa: Boolean(negocio.suscripcion_activa),
                modulos_activos: modulosActivos,
                avatar: await leerAvatar(negocio.id)
            }
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado' });
        }
        res.status(401).json({ error: 'Token inválido' });
    }
});

// ============ RECUPERACIÓN DE CONTRASEÑA ============

const MENSAJE_RECUPERACION = 'Si el correo está registrado, te enviamos un enlace para recuperar tu contraseña. Revisa también tu carpeta de spam.';

router.post('/forgot-password', [
    passwordResetRateLimit,
    body('email').isEmail().withMessage('Email requerido').normalizeEmail()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Email requerido' });
    try {
        const { email } = req.body;

        const [negocios] = await pool.query('SELECT id FROM negocios WHERE email_dueno = ?', [email]);
        if (negocios.length === 0) {
            // Misma respuesta exista o no el correo, para no revelar qué correos tienen cuenta.
            return res.json({ success: true, mensaje: MENSAJE_RECUPERACION });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos de validez

        await pool.query(
            'UPDATE negocios SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?',
            [tokenHash, expires, negocios[0].id]
        );

        const base = process.env.FRONTEND_URL || 'http://localhost:5173';
        const enlace = `${base.replace(/\/$/, '')}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            await avisarPorCorreo('recuperar_password', email, { enlace });
        } else if (process.env.NODE_ENV !== 'production') {
            console.log(`[Seguridad] SMTP sin configurar. Enlace de recuperación (solo dev): ${enlace}`);
        } else {
            console.error('[Seguridad] Falta SMTP_USER/SMTP_PASS: no se pudo enviar el correo de recuperación');
        }

        res.json({ success: true, mensaje: MENSAJE_RECUPERACION });
    } catch (error) {
        console.error('[Auth] Error forgot password:', error);
        res.status(500).json({ error: 'Error procesando solicitud' });
    }
});

router.post('/reset-password', [
    passwordResetRateLimit,
    body('email').isEmail().normalizeEmail(),
    body('token').isString().isLength({ min: 20, max: 200 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos incompletos' });
    try {
        const { email, token, newPassword } = req.body;

        const errorPassword = validarPassword(newPassword, { email });
        if (errorPassword) return res.status(400).json({ error: errorPassword });

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const [negocios] = await pool.query(
            'SELECT id FROM negocios WHERE email_dueno = ? AND reset_token_hash = ? AND reset_token_expires > NOW()',
            [email, tokenHash]
        );

        if (negocios.length === 0) {
            return res.status(400).json({ error: 'El enlace es inválido o ha expirado. Solicita uno nuevo.' });
        }

        const bcrypt = require('bcryptjs');
        const passwordHash = bcrypt.hashSync(newPassword, 12);

        // Además de cambiar la contraseña: el enlace es de un solo uso y se desbloquea la
        // cuenta (poder leer el correo prueba que es el dueño). Cambiar el hash invalida
        // las sesiones abiertas antes (ver huellaPassword).
        await pool.query(
            `UPDATE negocios SET password = ?, reset_token_hash = NULL, reset_token_expires = NULL,
                    intentos_login_fallidos = 0, cuenta_bloqueada = false WHERE id = ?`,
            [passwordHash, negocios[0].id]
        );

        avisarPorCorreo('password_cambiada', email, {});

        res.json({ success: true, mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
    } catch (error) {
        console.error('[Auth] Error reset password:', error);
        res.status(500).json({ error: 'Error actualizando contraseña' });
    }
});

module.exports = router;
