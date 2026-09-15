const fs = require('fs');
const db = require('../config/database');

// If a file-upload middleware ran before this check and the request
// ends up being rejected, delete the file it already wrote to disk
// instead of leaving an orphaned upload from an unauthorized caller.
function cleanupUploadedFile(req) {
    if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Failed to clean up rejected upload:', err);
        });
    }
}

function requireHRAccess(req, res, next) {
    const userId =
        req.query.user_id ||
        req.body.user_id ||
        req.headers['x-user-id'];

    if (!userId) {
        cleanupUploadedFile(req);
        return res.status(401).json({
            success: false,
            message: 'Unauthorized. User ID parameter missing.'
        });
    }

    const query = `
        SELECT department, position
        FROM users
        WHERE LOWER(user_id) = LOWER(?)
    `;

    db.query(query, [userId], (err, results) => {
        if (err || results.length === 0) {
            cleanupUploadedFile(req);
            return res.status(403).json({
                success: false,
                message: 'Access Denied: User verification failed.'
            });
        }

        const user = results[0];
        const department = (user.department || '').toLowerCase();
        const position = (user.position || '').toLowerCase();

        const isHR =
            department.includes('hr') ||
            department.includes('human resources') ||
            position.includes('hr');

        if (!isHR) {
            cleanupUploadedFile(req);
            return res.status(403).json({
                success: false,
                message: 'Access Denied: Only HR accounts can access this resource.'
            });
        }

        next();
    });
}

module.exports = { requireHRAccess };
