const express = require('express');
const cors = require('cors');
const instanceManager = require('./InstanceManager');
const { handleMessage } = require('./handlers/messageHandler');
const monitor = require('./monitor');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/internal/start/:negocioId', async (req, res) => {
  try {
    const { negocioId } = req.params;
    await instanceManager.startInstance(parseInt(negocioId));
    res.json({ success: true, message: 'Instancia iniciada' });
  } catch (error) {
    console.error('[Internal] Error al iniciar:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/internal/stop/:negocioId', async (req, res) => {
  try {
    const { negocioId } = req.params;
    await instanceManager.stopInstance(parseInt(negocioId));
    res.json({ success: true, message: 'Instancia detenida' });
  } catch (error) {
    console.error('[Internal] Error al detener:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/internal/status/:negocioId', (req, res) => {
  const { negocioId } = req.params;
  const status = instanceManager.getStatus(parseInt(negocioId));
  res.json(status);
});

app.get('/internal/status/all', (req, res) => {
  const instances = instanceManager.getAllInstances();
  res.json({ instances, total: instances.length });
});

app.post('/internal/message', async (req, res) => {
  try {
    const { negocio_id, numero, mensaje } = req.body;
    await instanceManager.sendMessage(negocio_id, numero, mensaje);
    res.json({ success: true });
  } catch (error) {
    console.error('[Internal] Error enviando mensaje:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/internal/buttons', async (req, res) => {
  try {
    const { negocio_id, numero, mensaje, botones } = req.body;
    await instanceManager.sendButtons(negocio_id, numero, mensaje, botones);
    res.json({ success: true });
  } catch (error) {
    console.error('[Internal] Error enviando botones:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/internal/image', async (req, res) => {
  try {
    const { negocio_id, numero, url, caption } = req.body;
    await instanceManager.sendImage(negocio_id, numero, url, caption);
    res.json({ success: true });
  } catch (error) {
    console.error('[Internal] Error enviando imagen:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    instances: instanceManager.getInstanceCount(),
    monitor: monitor.getStats(),
    timestamp: new Date().toISOString() 
  });
});

const PORT = process.env.PORT_INSTANCE_MANAGER || 3001;

async function start() {
  await instanceManager.initialize();
  
  app.listen(PORT, () => {
    console.log(`[Instance Manager] Corriendo en puerto ${PORT}`);
  });
  
  monitor.start();
}

if (require.main === module) {
  start();
}

process.on('SIGTERM', () => {
  console.log('[Instance Manager] Cerrando...');
  monitor.stop();
  process.exit(0);
});

module.exports = { app, instanceManager };
