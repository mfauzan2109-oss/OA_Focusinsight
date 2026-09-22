'use strict';
const express = require('express');
const mysql = require('mysql2/promise');
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');
const { freshUser } = require('../utils/resignation-approval');
const { listNotifications } = require('../utils/resignation-notifications');
const router = express.Router();
router.get('/api/resignation-notifications', requireLogin, async (req, res) => {
    let connection;
    res.set('Cache-Control', 'no-store');
    try {
        const { host, port, user, password, database, socketPath, ssl, timezone } = db.config;
        connection = await mysql.createConnection({ host, port, user, password, database, socketPath, ssl, timezone });
        const account = await freshUser(connection, req.session.user.user_id);
        res.json(await listNotifications(connection, account.user_id, req.query.before));
    } catch (error) {
        const status = error.status || 500;
        if (status === 500) console.error('Resignation notifications:', error);
        res.status(status).json({ success: false, message: status === 500 ? 'Unable to load notifications.' : error.message });
    } finally {
        if (connection) await connection.end().catch(() => {});
    }
});
module.exports = router;
