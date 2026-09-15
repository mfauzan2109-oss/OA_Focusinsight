const express = require('express');

const db = require('../config/database');

const router = express.Router();

router.post('/api/send-reminder', (req, res) => {
    const { id, type } = req.body;

    if (!id || !type) {
        return res.status(400).json({ success: false, message: 'Request ID and Type are required.' });
    }

    let tableName = '';
    const reqType = type.toLowerCase();

    if (reqType.includes('leave')) tableName = 'leave';
    else if (reqType.includes('disbursement')) tableName = 'disbursements';
    else if (reqType.includes('travel')) tableName = 'travel';
    else if (reqType.includes('overtime')) tableName = 'overtime';
    else if (reqType.includes('loan')) tableName = 'loans';
    else return res.status(400).json({ success: false, message: 'Invalid request type.' });

    const checkQuery = `SELECT id, created_at, last_reminder_sent, status FROM \`${tableName}\` WHERE id = ? OR ID = ?`;

    db.query(checkQuery, [id, id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ success: false, message: 'Request record not found.' });
        }

        const record = results[0];
        const status = (record.status || '').toLowerCase().trim();

        if (status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Reminders can only be sent for Pending requests.' });
        }

        const now = new Date();
        const lastCheck = record.last_reminder_sent ? new Date(record.last_reminder_sent) : new Date(record.created_at || now);
        const diffInHours = (now - lastCheck) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            const hoursLeft = Math.ceil(24 - diffInHours);
            return res.status(400).json({ 
                success: false, 
                message: `Reminder already sent recently. Please wait another ${hoursLeft} hour(s) before sending again.` 
            });
        }

        const updateQuery = `UPDATE \`${tableName}\` SET last_reminder_sent = NOW() WHERE id = ? OR ID = ?`;

        db.query(updateQuery, [id, id], (upErr) => {
            if (upErr) {
                console.error('Update Reminder Error:', upErr);
                return res.status(500).json({ success: false, message: 'Failed to send reminder.' });
            }

            return res.json({ 
                success: true, 
                message: 'Reminder notification successfully sent to the assigned approver!' 
            });
        });
    });
});

module.exports = router;
