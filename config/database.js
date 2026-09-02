const mysql = require('mysql2');

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'mysql',
    database: process.env.DB_NAME || 'portal_oa'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.stack);
        return;
    }

    console.log('Successfully connected to MySQL database.');
});

module.exports = db;
