function requireLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required.'
        });
    }

    next();
}

function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

function matchesHR(value) {
    const v = normalize(value);
    return v === 'hr' || v.includes('human resources');
}

function requireHRAccess(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required.'
        });
    }

    const user = req.session.user;

    // Temporary debug line: remove once the problem is fixed
    console.log('SESSION USER:', user);

    const isHR =
        matchesHR(user.department) ||
        matchesHR(user.dept) ||
        matchesHR(user.department_name) ||
        matchesHR(user.departmentName) ||
        matchesHR(user.position) ||
        matchesHR(user.job_title) ||
        matchesHR(user.jobTitle) ||
        matchesHR(user.role);

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