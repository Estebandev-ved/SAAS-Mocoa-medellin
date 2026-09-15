const http = require('http');

const loginData = JSON.stringify({ email: 'admin@noma.co', password: 'admin123' });
const loginReq = http.request({
    hostname: 'localhost',
    port: 3002,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const login = JSON.parse(data);
        const token = login.token;
        console.log('Token:', token ? 'OK' : 'FAIL');
        
        const pedidosReq = http.request({
            hostname: 'localhost',
            port: 3002,
            path: '/api/pedidos',
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token }
        }, (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => {
                console.log('Status:', res2.statusCode);
                console.log('Response:', data2);
                process.exit(0);
            });
        });
        pedidosReq.end();
    });
});
loginReq.write(loginData);
loginReq.end();
