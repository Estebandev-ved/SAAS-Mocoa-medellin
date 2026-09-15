require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./config');

async function run() {
    try {
        await db.execute("ALTER TABLE negocios ADD COLUMN bot_modo VARCHAR(20) DEFAULT 'todos'");
        console.log('Column bot_modo added');
    } catch (e) {
        console.log('bot_modo:', e.code === 'ER_DUP_FIELDNAME' ? 'already exists' : e.message);
    }

    try {
        await db.execute('ALTER TABLE negocios ADD COLUMN chat_whitelist TEXT');
        console.log('Column chat_whitelist added');
    } catch (e) {
        console.log('chat_whitelist:', e.code === 'ER_DUP_FIELDNAME' ? 'already exists' : e.message);
    }

    // Set default mode for existing businesses
    await db.execute("UPDATE negocios SET bot_modo = 'todos' WHERE bot_modo IS NULL");

    const [rows] = await db.execute("SELECT id, nombre, bot_modo, chat_whitelist FROM negocios");
    console.log('Negocios:', JSON.stringify(rows, null, 2));

    process.exit(0);
}

run();
