// Formulario público "quiero saber más" (enlace que se comparte en videos de Instagram/TikTok).
// Sin login. Cada envío entra al registro de prospectos con estado "nuevo" para que el admin
// le haga seguimiento. Montado en /api/public/interesados.
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../../db/config');
const { validarInteresado } = require('../services/prospectos');

// 5 envíos por hora por IP: suficiente para una persona real, frena el spam del formulario.
const limite = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Ya recibimos tus datos. Si necesitas algo más, escríbenos por WhatsApp.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/', limite, async (req, res) => {
    const { error, datos, bot } = validarInteresado(req.body);
    // Honeypot: un bot rellena el campo oculto; se responde "ok" para no darle pistas.
    if (bot) return res.status(201).json({ ok: true });
    if (error) return res.status(400).json({ error });
    try {
        // Mismo WhatsApp ya registrado: no se duplica, se agrega la nueva nota al prospecto.
        const [existe] = await db.execute('SELECT id FROM prospectos WHERE whatsapp = ? ORDER BY id DESC LIMIT 1', [datos.whatsapp]);
        if (existe.length) {
            await db.execute(
                "UPDATE prospectos SET notas = CONCAT(COALESCE(notas, ''), ?), proximo_seguimiento = CURDATE(), estado = IF(estado IN ('contactado','video_enviado','descartado'), 'respondio', estado) WHERE id = ?",
                [`\n[${new Date().toISOString().slice(0, 10)}] Volvió a llenar el formulario: ${datos.notas || '(sin mensaje)'}`, existe[0].id]
            );
        } else {
            const campos = Object.keys(datos);
            await db.execute(
                `INSERT INTO prospectos (${campos.join(', ')}, proximo_seguimiento) VALUES (${campos.map(() => '?').join(', ')}, CURDATE())`,
                campos.map((c) => datos[c])
            );
        }
        res.status(201).json({ ok: true });
    } catch (err) {
        console.error('[Interesados] Error guardando:', err.message);
        res.status(500).json({ error: 'No pudimos guardar tus datos. Intenta de nuevo en un momento.' });
    }
});

module.exports = router;
