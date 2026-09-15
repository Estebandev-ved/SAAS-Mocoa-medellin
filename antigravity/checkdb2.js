const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'antigravity'});
  
  try {
    const [auto] = await conn.query('DESCRIBE automatizaciones_config');
    console.log('---automatizaciones_config columns---');
    auto.forEach(r => console.log(r.Field, r.Type));
  } catch(e) { console.log('automatizaciones_config error:', e.message); }

  try {
    const [rows] = await conn.query('SELECT * FROM automatizaciones_config LIMIT 5');
    console.log('\n---automatizaciones_config data---');
    console.log(JSON.stringify(rows, null, 2));
  } catch(e) { console.log('automatizaciones_config data error:', e.message); }
  
  await conn.end();
})();
