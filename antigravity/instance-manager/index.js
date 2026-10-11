require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const instanceManager = require('./InstanceManager');
const { handleMessage } = require('./handlers/messageHandler');
const monitor = require('./monitor');
const { setSocketIO } = require('./socketEmitter');
const { io: socketClient } = require('socket.io-client');
const SubscriptionNotifier = require('./subscriptionNotifier');

const app = express();
app.use(cors());

// Webhook de la Cloud API de Meta (cuerpo crudo para validar la firma; va antes de express.json)
const cloudApi = require('./providers/CloudApiProvider');
app.get('/webhook/whatsapp', (req, res) => {
  const token = process.env.META_VERIFY_TOKEN;
  if (token && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === token) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});
app.post('/webhook/whatsapp', express.raw({ type: '*/*', limit: '2mb' }), (req, res) => {
  if (!cloudApi.firmaValida(req.body, req.get('x-hub-signature-256'), process.env.META_APP_SECRET)) {
    return res.sendStatus(401);
  }
  res.sendStatus(200); // Meta exige responder rápido; se procesa después
  let body;
  try { body = JSON.parse(req.body.toString('utf8')); } catch { return; }
  cloudApi.despachar(body).catch((e) => console.error('[CloudApi] webhook:', e.message));
});

app.use(express.json());

const API_URL = process.env.API_URL || 'http://localhost:3002';
const SOCKET_SECRET = process.env.SOCKET_SECRET || 'secreto_interno_antigravity';
const socket = socketClient(API_URL, {
  auth: { tipo: 'bot_interno', secret: SOCKET_SECRET },
  reconnection: true,
  reconnectionDelay: 5000,
});

socket.on('connect', () => {
  console.log('[Instance Manager] Conectado al API Server socket');
  setSocketIO(socket);
});

socket.on('connect_error', (err) => {
  console.error('[Instance Manager] Error de conexión socket:', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('[Instance Manager] Socket desconectado:', reason);
});

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

app.get('/internal/status/all', (req, res) => {
  const instances = instanceManager.getAllInstances();
  res.json({ instances, total: instances.length });
});

app.get('/internal/status/:negocioId', (req, res) => {
  const { negocioId } = req.params;
  const status = instanceManager.getStatus(parseInt(negocioId));
  res.json(status);
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

  // Start subscription notifier (checks every hour)
  const subNotifier = new SubscriptionNotifier(socket);
  subNotifier.start(3600000);
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
