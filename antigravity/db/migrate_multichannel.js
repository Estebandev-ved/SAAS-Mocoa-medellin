const db = require('../db/config');
(async () => {
    try {
        await db.execute("ALTER TABLE negocios ADD COLUMN telegram_bot_token VARCHAR(255) AFTER numero_bancolombia");
        console.log('Columna telegram_bot_token agregada');
    } catch (e) {
        if (e.message.includes('Duplicate column')) console.log('telegram_bot_token ya existe');
        else console.error('Error:', e.message);
    }

    try {
        await db.execute("ALTER TABLE negocios ADD COLUMN telegram_bot_nombre VARCHAR(100) AFTER telegram_bot_token");
        console.log('Columna telegram_bot_nombre agregada');
    } catch (e) {
        if (e.message.includes('Duplicate column')) console.log('telegram_bot_nombre ya existe');
        else console.error('Error:', e.message);
    }

    try {
        await db.execute("ALTER TABLE negocios ADD COLUMN instagram_token VARCHAR(255) AFTER telegram_bot_nombre");
        console.log('Columna instagram_token agregada');
    } catch (e) {
        if (e.message.includes('Duplicate column')) console.log('instagram_token ya existe');
        else console.error('Error:', e.message);
    }

    try {
        await db.execute("ALTER TABLE negocios ADD COLUMN instagram_user_id VARCHAR(100) AFTER instagram_token");
        console.log('Columna instagram_user_id agregada');
    } catch (e) {
        if (e.message.includes('Duplicate column')) console.log('instagram_user_id ya existe');
        else console.error('Error:', e.message);
    }

    process.exit(0);
})();
