const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

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

const { body, validationResult } = require('express-validator');
const { loginRateLimit, sanitizeLog, blacklistToken, checkBlacklist } = require('../middleware/security');

function getClientIP(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

router.post('/registro', [
    body('email_dueno').isEmail().withMessage('Debe ser un correo electrónico válido').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
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
        const trialFin = new Date();
        trialFin.setDate(trialFin.getDate() + 7);

        const [result] = await pool.query(
            `INSERT INTO negocios (nombre, email_dueno, whatsapp, password, plan, suscripcion_fin, suscripcion_activa, terminos_aceptados, terminos_fecha, color_principal) 
             VALUES (?, ?, ?, ?, 'starter', ?, true, ?, NOW(), '#00D9FF')`,
            [nombre, email_dueno, whatsapp, passwordHash, trialFin, terminos_aceptados || false]
        );

        const token = jwt.sign(
            { negocio_id: result.insertId, email: email_dueno, plan: 'starter', nombre },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            mensaje: 'Cuenta creada',
            negocio: {
                id: result.insertId,
                nombre,
                email: email_dueno,
                plan: 'starter',
                color_principal: '#00D9FF',
                onboarding_completado: false
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
            return res.status(403).json({ error: 'Cuenta bloqueada' });
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
                return res.status(403).json({ error: 'Cuenta bloqueada' });
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

        const token = jwt.sign(
            { negocio_id: negocio.id, email: negocio.email_dueno, plan: negocio.plan, nombre: negocio.nombre, rol: negocio.rol || 'negocio' },
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
                rol: negocio.rol || 'negocio',
                color_principal: negocio.color_principal || '#00D9FF',
                logo_url: negocio.logo_url,
                onboarding_completado: Boolean(negocio.onboarding_completado),
                trial_hasta: negocio.trial_hasta,
                suscripcion_activa: Boolean(negocio.suscripcion_activa)
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
                suscripcion_activa: Boolean(negocio.suscripcion_activa)
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

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email requerido' });

        const [negocios] = await pool.query('SELECT id FROM negocios WHERE email_dueno = ?', [email]);
        if (negocios.length === 0) {
            // Devuelve success igual por seguridad para no revelar si existe el correo
            return res.json({ success: true, mensaje: 'Si el correo existe, se enviará un enlace de recuperación.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        
        const expires = new Date();
        expires.setHours(expires.getHours() + 1); // 1 hora de validez

        await pool.query(
            'UPDATE negocios SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?',
            [tokenHash, expires, negocios[0].id]
        );

        // TODO: Módulo de emails real pendiente para prod
        console.log(`[Seguridad] Enlace de recuperación (Solo Dev): http://localhost:5177/reset-password?token=${resetToken}&email=${email}`);

        res.json({ success: true, mensaje: 'Si el correo existe, se enviará un enlace de recuperación.' });
    } catch (error) {
        console.error('[Auth] Error forgot password:', error);
        res.status(500).json({ error: 'Error procesando solicitud' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;
        if (!email || !token || !newPassword) return res.status(400).json({ error: 'Datos incompletos' });

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

        await pool.query(
            'UPDATE negocios SET password = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?',
            [passwordHash, negocios[0].id]
        );

        res.json({ success: true, mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
    } catch (error) {
        console.error('[Auth] Error reset password:', error);
        res.status(500).json({ error: 'Error actualizando contraseña' });
    }
});

module.exports = router;
