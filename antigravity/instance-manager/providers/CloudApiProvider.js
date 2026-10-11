// Proveedor oficial: WhatsApp Cloud API de Meta. Sin QR: el negocio se conecta con Embedded Signup
// (login de Facebook) y nos llegan phone_number_id + access_token. Los mensajes entran por webhook.
// ESTADO: escrito contra la documentación pública y probado solo con payloads de ejemplo
// (test/unit/cloudApiProvider.test.js); no se ha probado contra Meta real.
const crypto = require('crypto');

const GRAPH = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`;

// phone_number_id -> instancia, para enrutar el webhook al negocio correcto
const registro = new Map();

// Convierte el payload del webhook en mensajes con la misma forma que usa el handler (estilo Baileys).
function normalizarWebhook(body) {
  const salida = [];
  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      const phoneNumberId = v.metadata?.phone_number_id;
      for (const m of v.messages || []) {
        const key = { remoteJid: `${m.from}@s.whatsapp.net`, fromMe: false, id: m.id };
        const base = { key, messageTimestamp: Number(m.timestamp) };
        let message = null;
        if (m.type === 'text') message = { conversation: m.text?.body || '' };
        else if (m.type === 'image') message = { imageMessage: { caption: m.image?.caption || '', mediaId: m.image?.id } };
        else if (m.type === 'interactive' && m.interactive?.button_reply) {
          message = { buttonsResponseMessage: { selectedButtonId: m.interactive.button_reply.id } };
        } else if (m.type === 'interactive' && m.interactive?.list_reply) {
          message = { listResponseMessage: { singleSelectReply: { selectedRowId: m.interactive.list_reply.id } } };
        } else if (m.type === 'button') message = { conversation: m.button?.text || '' };
        if (message) salida.push({ phoneNumberId, msg: { ...base, message } });
      }
    }
  }
  return salida;
}

// Valida la cabecera X-Hub-Signature-256 con el App Secret de Meta (cuerpo crudo).
function firmaValida(rawBody, header, appSecret) {
  if (!appSecret || !header || !rawBody) return false;
  const esperado = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function despachar(body) {
  for (const { phoneNumberId, msg } of normalizarWebhook(body)) {
    const prov = registro.get(String(phoneNumberId));
    if (!prov) {
      console.warn(`[CloudApi] Mensaje para phone_number_id desconocido: ${phoneNumberId}`);
      continue;
    }
    try {
      await prov.onMessage(prov.sock, msg);
    } catch (e) {
      console.error(`[Bot-${prov.negocioId}] Error handleMessage:`, e.message);
    }
  }
}

class CloudApiProvider {
  constructor({ negocioId, credenciales = {}, onMessage, onConnected, onDisconnected }) {
    this.kind = 'cloud_api';
    this.negocioId = negocioId;
    this.phoneNumberId = credenciales.phoneNumberId ? String(credenciales.phoneNumberId) : null;
    this.token = credenciales.accessToken || null;
    this.displayPhone = credenciales.displayPhone || null;
    this.onMessage = onMessage;
    this.onConnected = onConnected;
    this.onDisconnected = onDisconnected;
    this.ready = false;
    // Misma forma que el "sock" de Baileys que consume el handler
    this.sock = {
      sendMessage: (jid, contenido) => this._enviarContenido(jid, contenido),
      downloadMediaMessage: (msg) => this._descargar(msg),
      store: { contacts: {} },
    };
  }

  async start() {
    if (!this.phoneNumberId || !this.token) {
      throw new Error(`Negocio ${this.negocioId}: faltan credenciales de Cloud API (phoneNumberId/accessToken)`);
    }
    registro.set(this.phoneNumberId, this);
    this.ready = true;
    console.log(`[Bot-${this.negocioId}] ✓ CONECTADO (cloud_api, phone_number_id ${this.phoneNumberId})`);
    this.onConnected(this.displayPhone);
  }

  async stop() {
    if (this.phoneNumberId && registro.get(this.phoneNumberId) === this) registro.delete(this.phoneNumberId);
    this.ready = false;
  }

  isReady() { return this.ready; }
  getPhoneNumber() { return this.displayPhone; }

  async _post(cuerpo) {
    const res = await fetch(`${GRAPH()}/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...cuerpo }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Cloud API ${res.status}: ${data?.error?.message || 'error'}`);
    return data;
  }

  _enviarContenido(jid, c) {
    const to = String(jid).split('@')[0].replace(/[^0-9]/g, '');
    if (c.image) return this.sendImage(to, c.image, c.caption);
    if (c.buttons) return this.sendButtons(to, c.text, c.buttons.map(b => ({ id: b.buttonId, text: b.buttonText?.displayText })));
    return this.sendMessage(to, c.text);
  }

  sendMessage(numero, texto) {
    return this._post({ to: numero.replace(/[^0-9]/g, ''), type: 'text', text: { body: texto } });
  }

  // Cloud API admite hasta 3 botones de respuesta
  sendButtons(numero, texto, botones) {
    return this._post({
      to: numero.replace(/[^0-9]/g, ''),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: texto },
        action: { buttons: botones.slice(0, 3).map((b, i) => ({ type: 'reply', reply: { id: b.id || `btn_${i}`, title: String(b.text).slice(0, 20) } })) },
      },
    });
  }

  sendImage(numero, url, caption) {
    return this._post({ to: numero.replace(/[^0-9]/g, ''), type: 'image', image: { link: url, caption: caption || '' } });
  }

  // Dos pasos: pedir la URL del media y descargarla con el mismo token
  async _descargar(msg) {
    const id = msg?.message?.imageMessage?.mediaId;
    if (!id) return null;
    const meta = await (await fetch(`${GRAPH()}/${id}`, { headers: { Authorization: `Bearer ${this.token}` } })).json();
    if (!meta.url) return null;
    const r = await fetch(meta.url, { headers: { Authorization: `Bearer ${this.token}` } });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  }
}

module.exports = CloudApiProvider;
module.exports.normalizarWebhook = normalizarWebhook;
module.exports.firmaValida = firmaValida;
module.exports.despachar = despachar;
