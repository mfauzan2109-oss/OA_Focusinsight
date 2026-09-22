function requireLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required.'
        });
    }

    next();
}

function requireHRAccess(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required.'
        });
    }

    const department = String(
        req.session.user.department || ''
    ).trim().toLowerCase();

    const position = String(
        req.session.user.position || ''
    ).trim().toLowerCase();

    const isHR =
        department.includes('human resources') ||
        department === 'hr' ||
        position.includes('human resources') ||
        position === 'hr';

    if (!isHR) {
        return res.status(403).json({
            success: false,
            message: 'Access Denied: Only HR accounts can access this resource.'
        });
    }

    next();
}

module.exports = {
    requireLogin,
    requireHRAccess
};