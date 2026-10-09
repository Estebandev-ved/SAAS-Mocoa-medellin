// Verifica en segundos si Efipay acepta un token, sin desplegar ni crear ningún pago.
//
//   cd antigravity
//   node efipay-check.js
//
// Te pide el token y la oficina por la terminal (no se guardan en ningún archivo ni se muestran
// después). Si prefieres, también lee EFIPAY_ACCESS_TOKEN y EFIPAY_OFFICE_ID del entorno.
// Pega el token COMPLETO, con el "|" si lo trae.
const readline = require('readline');

(async () => {
    const lineas = readline.createInterface({ input: process.stdin, output: process.stdout })[Symbol.asyncIterator]();
    const preguntar = async (texto) => { process.stdout.write(texto); return ((await lineas.next()).value || '').trim(); };
    if (!process.env.EFIPAY_ACCESS_TOKEN) process.env.EFIPAY_ACCESS_TOKEN = await preguntar('Token de Efipay (completo): ');
    if (!process.env.EFIPAY_OFFICE_ID) process.env.EFIPAY_OFFICE_ID = await preguntar('ID de la oficina: ');

    const db = require('./db/config');
    const efipay = require('./api/services/efipay');
    const d = await efipay.diagnosticar();
    console.log('\n--- Resultado ---');
    console.log(`Token: ${d.token_longitud} caracteres (el de un token con "|" suele rondar los 52)`);
    console.log(`Oficina: ${d.office_id}`);
    console.log(`Respuesta de Efipay: HTTP ${d.http_auth}`);
    console.log(d.credenciales_ok === true ? '✅ ' + d.interpretacion : d.credenciales_ok === false ? '❌ ' + d.interpretacion : '⚠️  ' + d.interpretacion);
    await db.end().catch(() => {});
    process.exit(d.credenciales_ok ? 0 : 1);
})();
