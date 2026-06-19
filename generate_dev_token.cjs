const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './antigravity/.env' });

const negocio = {
    id: 1,
    nombre: 'Tienda Ejemplo Colombia',
    plan: 'professional',
    email: 'dueno@tienda.com'
};

const secret = process.env.JWT_SECRET || 'antigravity_secret_key_change_in_production';

const token = jwt.sign(negocio, secret, {
    expiresIn: '365d' // Long lived for dev
});

console.log('--- TOKEN GENERADO ---');
console.log(token);
console.log('----------------------');
