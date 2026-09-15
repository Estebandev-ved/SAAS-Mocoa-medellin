const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'',database:'antigravity'});
  const [tables] = await conn.query('SHOW TABLES');
  console.log('TABLES:', tables.map(r => Object.values(r)[0]));
  
  try {
    const [neg] = await conn.query('DESCRIBE negocios');
    console.log('\n---negocios columns---');
    neg.forEach(r => console.log(r.Field));
  } catch(e) { console.log('negocios error:', e.message); }
  
  try {
    const [dom] = await conn.query('DESCRIBE domicilios');
    console.log('\n---domicilios columns---');
    dom.forEach(r => console.log(r.Field));
  } catch(e) { console.log('domicilios error:', e.message); }
  
  try {
    const [drv] = await conn.query('DESCRIBE domiciliarios');
    console.log('\n---domiciliarios columns---');
    drv.forEach(r => console.log(r.Field));
  } catch(e) { console.log('domiciliarios error:', e.message); }
  
  try {
    const [conv] = await conn.query('DESCRIBE conversaciones');
    console.log('\n---conversaciones columns---');
    conv.forEach(r => console.log(r.Field));
  } catch(e) { console.log('conversaciones error:', e.message); }
  
  await conn.end();
})();
