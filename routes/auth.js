const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ==========================================================================
// API ROUTE: EMPLOYEE LOGIN
// ==========================================================================
router.post('/api/login', (req, res) => {
    const { user_id, password } = req.body;
    const query = 'SELECT * FROM users WHERE LOWER(user_id) = LOWER(?)';
    
    db.query(query, [user_id], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ success: false, message: 'Server database error.' });
        }
        if (results.length > 0) {
            const user = results[0];
            if (user.password === password) {
                return res.json({
                    success: true,
                    user_id: user.user_id,
                    name: user.name,
                    position: user.position,
                    department: user.department,
                    company_name: user.company_name
                });
            } else {
                return res.json({ success: false, message: 'Incorrect password.' });
            }
        } else {
            return res.json({ success: false, message: 'Employee ID not found.' });
        }
    });
});

module.exports = router;
