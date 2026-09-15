const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'antigravity_secret_key_change_in_production';
const token = jwt.sign({ negocio_id: 8, nombre: 'Test', plan: 'starter', email: 'admin@noma.co', rol: 'negocio' }, JWT_SECRET, { expiresIn: '1h' });

function testEndpoint(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/api' + path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      timeout: 10000
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`${method} ${path} -> ${res.statusCode}`);
        if (res.statusCode >= 400) console.log('  Response:', data.substring(0, 200));
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', e => { console.log(`${method} ${path} -> ERROR: ${e.message}`); reject(e); });
    req.on('timeout', () => { console.log(`${method} ${path} -> TIMEOUT`); req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  await testEndpoint('GET', '/bot/config');
  await testEndpoint('GET', '/domicilios/active');
  await testEndpoint('GET', '/domicilios/drivers');
  await testEndpoint('GET', '/conversaciones');
  await testEndpoint('GET', '/pedidos');
  await testEndpoint('GET', '/analytics/resumen');
  await testEndpoint('GET', '/negocio/perfil');
  await testEndpoint('GET', '/negocio/plan');
})();
