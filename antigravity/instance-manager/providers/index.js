const BaileysProvider = require('./BaileysProvider');
const CloudApiProvider = require('./CloudApiProvider');

// 'baileys' (QR, por defecto) o 'cloud_api' (oficial de Meta).
function createProvider(kind, opts) {
  if (kind === 'cloud_api') return new CloudApiProvider(opts);
  return new BaileysProvider(opts);
}

module.exports = { createProvider };
