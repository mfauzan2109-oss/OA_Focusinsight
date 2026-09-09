const db = require('../config/db');

// ==========================================================================
// HR SECURITY AUTHORIZATION MIDDLEWARE
// ==========================================================================
function requireHRAccess(req, res, next) {
    const userId = req.query.user_id || req.body.user_id || req.headers['x-user-id'];

    if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized. User ID parameter missing.' });
    }

    const query = 'SELECT department, position FROM users WHERE LOWER(user_id) = LOWER(?)';
    db.query(query, [userId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(403).json({ success: false, message: 'Access Denied: User verification failed.' });
        }

        const user = results[0];
        const dept = (user.department || '').toLowerCase();
        const pos = (user.position || '').toLowerCase();

        const isHR = dept.includes('hr') || dept.includes('human resources') || pos.includes('hr');

        if (!isHR) {
            return res.status(403).json({ success: false, message: 'Access Denied: Only HR accounts can access this resource.' });
        }

        next();
    });
}

module.exports = requireHRAccess;
