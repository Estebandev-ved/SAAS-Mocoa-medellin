// Envío de correos directo desde la API (nodemailer). Sirve para avisos que no pueden depender
// del WhatsApp del negocio ni de Redis (como las renovaciones: un cliente de la Caja no tiene bot).
// Sin SMTP configurado no falla: devuelve { ok: false, motivo: 'sin_smtp' } y quien llama decide.
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS  (obligatorios SMTP_USER y SMTP_PASS)
//   SMTP_FROM  (opcional, p. ej. "Antigravity <avisos@tudominio.co>"; con Gmail debe ser el mismo SMTP_USER)
const nodemailer = require('nodemailer');

let transporteCompartido = null;

function correoConfigurado(env = process.env) {
    return !!(String(env.SMTP_USER || '').trim() && String(env.SMTP_PASS || '').trim());
}

function obtenerTransporte(env = process.env) {
    if (!transporteCompartido) {
        const puerto = parseInt(env.SMTP_PORT || '587', 10);
        transporteCompartido = nodemailer.createTransport({
            host: env.SMTP_HOST || 'smtp.gmail.com',
            port: puerto,
            secure: puerto === 465,
            auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });
    }
    return transporteCompartido;
}

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// `transporte` y `env` se inyectan solo en los tests.
async function enviarCorreo({ para, asunto, texto, html }, { transporte = null, env = process.env } = {}) {
    if (!para || !CORREO_VALIDO.test(String(para).trim())) return { ok: false, motivo: 'sin_correo' };
    if (!transporte && !correoConfigurado(env)) return { ok: false, motivo: 'sin_smtp' };
    try {
        const t = transporte || obtenerTransporte(env);
        await t.sendMail({
            from: env.SMTP_FROM || `"Antigravity" <${env.SMTP_USER}>`,
            to: String(para).trim(),
            subject: asunto,
            text: texto,
            html,
        });
        return { ok: true };
    } catch (error) {
        console.error('[Correo] No se pudo enviar:', error.code || error.message);
        return { ok: false, motivo: 'error', detalle: error.message };
    }
}

module.exports = { correoConfigurado, enviarCorreo };
