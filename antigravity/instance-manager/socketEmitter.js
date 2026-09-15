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

module.exports = {
  setSocketIO,
  emitQR,
  emitConnected,
  emitDisconnected,
  emitCampaignProgress,
  emitNewMessage
};
