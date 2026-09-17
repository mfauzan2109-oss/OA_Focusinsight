const express = require('express');

const db = require('../config/database');
const { requireHRAccess } = require('../middleware/auth');

const router = express.Router();

const VALID_AUDIENCES = ['All', 'Employee', 'Manager', 'CEO', 'HR'];

// Create a new announcement (HR only)
router.post('/api/announcements', requireHRAccess, (req, res) => {
    const { title, message, targetAudience, publishDate, expiryDate } = req.body;
    const userId = req.body.user_id || req.headers['x-user-id'] || null;

    const cleanTitle = (title || '').trim();
    const cleanMessage = (message || '').trim();
    const cleanAudience = (targetAudience || '').trim();

    if (!cleanTitle || !cleanMessage || !cleanAudience || !publishDate || !expiryDate) {
        return res.status(400).json({
            success: false,
            message: 'Title, Message, Target Audience, Publish Date and Expiry Date are all required.'
        });
    }

    if (!VALID_AUDIENCES.includes(cleanAudience)) {
        return res.status(400).json({
            success: false,
            message: `Target Audience must be one of: ${VALID_AUDIENCES.join(', ')}.`
        });
    }

    if (new Date(expiryDate) < new Date(publishDate)) {
        return res.status(400).json({ success: false, message: 'Expiry Date cannot be before Publish Date.' });
    }

    const insertQuery = `
        INSERT INTO announcements
        (title, message, target_audience, publish_date, expiry_date, created_by, status)
        VALUES (?, ?, ?, ?, ?, ?, 'Active')
    `;

    db.query(insertQuery, [cleanTitle, cleanMessage, cleanAudience, publishDate, expiryDate, userId], (err, result) => {
        if (err) {
            console.error('Create Announcement Error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }
        return res.json({ success: true, message: 'Announcement created successfully!', announcementId: result.insertId });
    });
});

// List announcements. Any logged-in user can view; HR sees everything,
// everyone else only sees announcements targeted at them (or "All").
router.get('/api/announcements', (req, res) => {
    const audience = (req.query.audience || '').trim();

    let query = `SELECT id, title, message, target_audience, publish_date, expiry_date, created_by, status, created_at FROM announcements WHERE status = 'Active'`;
    const params = [];

    if (audience && audience !== 'HR') {
        query += ` AND (target_audience = 'All' OR target_audience = ?)`;
        params.push(audience);
    }

    query += ` ORDER BY publish_date DESC, created_at DESC`;

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Fetch Announcements Error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }
        return res.json({ success: true, data: results });
    });
});

module.exports = router;
