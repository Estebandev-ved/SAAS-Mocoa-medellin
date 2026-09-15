require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

async function run() {
    await db.execute("UPDATE negocios SET chat_whitelist = '573249704667,105708238405685' WHERE id = 8");
    const [r] = await db.execute('SELECT chat_whitelist FROM negocios WHERE id = 8');
    console.log('Whitelist:', r[0].chat_whitelist);
    process.exit(0);
}

run();
