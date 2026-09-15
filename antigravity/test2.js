const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'antigravity_secret_key_change_in_production';
const token = jwt.sign({ negocio_id: 8, nombre: 'Test', plan: 'starter', email: 'admin@noma.co', rol: 'negocio' }, JWT_SECRET, { expiresIn: '1h' });

function testEndpoint(method, path) {
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
        try {
          const parsed = JSON.parse(data);
          console.log(JSON.stringify(parsed, null, 2).substring(0, 500));
        } catch {
          console.log(data.substring(0, 500));
        }
        resolve();
      });
    });
    req.on('error', e => { console.log(`ERROR: ${e.message}`); reject(e); });
    req.end();
  });
}

(async () => {
  await testEndpoint('GET', '/bot/config');
  console.log('---');
  await testEndpoint('GET', '/conversaciones');
})();
