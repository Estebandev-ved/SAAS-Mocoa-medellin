const axios = require('axios');

function formatearJid(numero) {
    let limpio = numero.replace(/\D/g, '');
    if (!limpio.startsWith('57')) {
        limpio = '57' + limpio;
    }
    return limpio + '@s.whatsapp.net';
}

async function enviarMensaje(sock, whatsapp, texto) {
    try {
        const jid = formatearJid(whatsapp);
        
        const mensaje = await sock.sendMessage(jid, {
            text: texto
        });

        console.log(`[WhatsApp] Mensaje enviado a ${whatsapp}:`, texto.substring(0, 50) + '...');
        return mensaje;
    } catch (error) {
        console.error(`[WhatsApp] Error enviando mensaje a ${whatsapp}:`, error.message);
        throw error;
    }
}

async function enviarMensajeConBotones(sock, whatsapp, texto, botones) {
    try {
        const jid = formatearJid(whatsapp);
        
        const botonesFormateados = botones.map((btn, index) => ({
            buttonId: `btn_${index}_${Date.now()}`,
            buttonText: { displayText: btn.texto },
            type: 1
        }));

        const mensaje = await sock.sendMessage(jid, {
            text: texto,
            footer: 'ANTIGRAVITY - Sistema de Automatización',
            buttons: botonesFormateados,
            headerType: 1
        });

        console.log(`[WhatsApp] Mensaje con botones enviado a ${whatsapp}`);
        return mensaje;
    } catch (error) {
        console.error(`[WhatsApp] Error enviando mensaje con botones:`, error.message);
        throw error;
    }
}

async function enviarMensajeConImagen(sock, whatsapp, imagenUrl, caption) {
    try {
        const jid = formatearJid(whatsapp);
        
        const mensaje = await sock.sendMessage(jid, {
            image: { url: imagenUrl },
            caption: caption
        });

        console.log(`[WhatsApp] Imagen enviada a ${whatsapp}:`, caption.substring(0, 30) + '...');
        return mensaje;
    } catch (error) {
        console.error(`[WhatsApp] Error enviando imagen a ${whatsapp}:`, error.message);
        throw error;
    }
}

async function enviarMensajeConLista(sock, whatsapp, texto, secciones) {
    try {
        const jid = formatearJid(whatsapp);
        
        const mensaje = await sock.sendMessage(jid, {
            text: texto,
            sections: secciones
        });

        console.log(`[WhatsApp] Mensaje con lista enviado a ${whatsapp}`);
        return mensaje;
    } catch (error) {
        console.error(`[WhatsApp] Error enviando mensaje con lista:`, error.message);
        throw error;
    }
}

function extraerNumeroDeJid(jid) {
    if (!jid) return null;
    return jid.split('@')[0].replace(/^57/, '');
}

module.exports = {
    formatearJid,
    enviarMensaje,
    enviarMensajeConBotones,
    enviarMensajeConImagen,
    enviarMensajeConLista,
    extraerNumeroDeJid
};
