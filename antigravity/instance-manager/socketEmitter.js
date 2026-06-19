const { io } = require('../api/index');

function emitQR(negocioId, qr) {
  if (io) {
    io.to(`negocio_${negocioId}`).emit('bot_qr', {
      negocioId,
      qr: qr,
      timestamp: new Date().toISOString()
    });
  }
}

function emitConnected(negocioId) {
  if (io) {
    io.to(`negocio_${negocioId}`).emit('bot_connected', {
      negocioId,
      timestamp: new Date().toISOString()
    });
  }
}

function emitDisconnected(negocioId) {
  if (io) {
    io.to(`negocio_${negocioId}`).emit('bot_disconnected', {
      negocioId,
      timestamp: new Date().toISOString()
    });
  }
}

function emitCampaignProgress(negocioId, campaignId, progress) {
  if (io) {
    io.to(`negocio_${negocioId}`).emit('campaña_progreso', {
      campaignId,
      ...progress
    });
  }
}

function emitNewMessage(negocioId, message) {
  if (io) {
    io.to(`negocio_${negocioId}`).emit('nuevo_mensaje', message);
  }
}

module.exports = {
  emitQR,
  emitConnected,
  emitDisconnected,
  emitCampaignProgress,
  emitNewMessage
};
