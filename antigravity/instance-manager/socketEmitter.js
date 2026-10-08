// `io` acá NO es un servidor de Socket.IO: es el cliente (`socket.io-client`)
// con el que instance-manager se conecta a la API como "bot_interno" (ver
// InstanceManager/index.js -> setSocketIO). Por eso cada función solo hace
// `io.emit(...)`, mandando el evento a la API — el aislamiento por negocio
// (`io.to('negocio_<id>').emit(...)`) pasa del lado del SERVIDOR, en
// api/index.js, que reenvía cada evento solo al room de ese negocio. Un evento
// nuevo acá no llega a ningún dashboard hasta que también tenga su
// `socket.on(...)` de reenvío en el bloque `isBotInterno` de api/index.js.
let io = null;

function setSocketIO(socketIO) {
  io = socketIO;
}

function emitQR(negocioId, qr) {
  if (io) {
    io.emit('qr_update', {
      negocio_id: negocioId,
      qr_data: qr,
      timestamp: new Date().toISOString()
    });
  }
}

function emitConnected(negocioId, phone) {
  if (io) {
    io.emit('whatsapp_status', {
      negocio_id: negocioId,
      conectado: true,
      numero: phone || null,
      timestamp: new Date().toISOString()
    });
  }
}

function emitDisconnected(negocioId) {
  if (io) {
    io.emit('whatsapp_status', {
      negocio_id: negocioId,
      conectado: false,
      numero: null,
      timestamp: new Date().toISOString()
    });
  }
}

function emitCampaignProgress(negocioId, campaignId, progress) {
  if (io) {
    io.emit('campaign_progress', {
      negocio_id: negocioId,
      campaignId,
      ...progress
    });
  }
}

function emitNewMessage(negocioId, message) {
  if (io) {
    io.emit('nuevo_mensaje', {
      negocio_id: negocioId,
      ...message
    });
  }
}

function emitDomicilioNuevo(negocioId, data) {
  if (io) {
    io.emit('domicilio_nuevo', {
      negocio_id: negocioId,
      ...data
    });
  }
}

// Pedido recién creado por el bot, todavía sin pago verificado — aviso suave
// (el dueño no tiene nada que aceptar/rechazar todavía, solo enterarse).
// Reusa el evento 'nuevo_pedido': la API ya lo reenvía (io.on('connection') /
// isBotInterno) y OrdersPage.jsx ya lo escucha (onNuevoPedido); nadie lo emitía.
function emitPedidoNuevo(negocioId, data) {
  if (io) {
    io.emit('nuevo_pedido', {
      negocio_id: negocioId,
      ...data
    });
  }
}

// Pago verificado (por la IA, automático): este es el momento "tipo Rappi" —
// hay dinero real y el pedido pasa a tu cocina/mostrador, necesita que
// alguien lo marque en preparación.
function emitPedidoConfirmado(negocioId, data) {
  if (io) {
    io.emit('pedido_confirmado', {
      negocio_id: negocioId,
      ...data
    });
  }
}

module.exports = {
  setSocketIO,
  emitQR,
  emitConnected,
  emitDisconnected,
  emitCampaignProgress,
  emitNewMessage,
  emitDomicilioNuevo,
  emitPedidoNuevo,
  emitPedidoConfirmado
};
