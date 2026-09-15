const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'antigravity'});
  
  try {
    const [msgs] = await conn.query('DESCRIBE mensajes');
    console.log('---mensajes columns---');
    msgs.forEach(r => console.log(r.Field, r.Type));
  } catch(e) { console.log('mensajes error:', e.message); }
  
  try {
    const [cli] = await conn.query('DESCRIBE clientes');
    console.log('\n---clientes columns---');
    cli.forEach(r => console.log(r.Field, r.Type));
  } catch(e) { console.log('clientes error:', e.message); }
  
  await conn.end();
})();
