require('dotenv').config();

module.exports = {
    mysql: {
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'antigravity'
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'antigravity_secret_key'
    },
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY
    },
    ownerEmail: process.env.OWNER_EMAIL,
    ports: {
        bot: process.env.PORT_BOT || 3001,
        api: process.env.PORT_API || 3002,
        brain: process.env.PORT_BRAIN || 8000
    }
};
