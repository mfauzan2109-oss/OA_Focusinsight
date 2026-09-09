const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ==========================================================================
// API ROUTE: SUBMIT RECRUITMENT REQUISITION FORM
// ==========================================================================
router.post('/api/submit-recruitment', (req, res) => {
    const {
        requested_by, requester_id, requester_department,
        requester_position, request_date, positions
    } = req.body;

    if (!requester_id) {
        return res.status(400).json({ success: false, message: 'Requester ID is required.' });
    }

    if (!Array.isArray(positions) || positions.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one position is required.' });
    }

    const invalidPos = positions.find(p => !p.job_title || !p.department || !p.vacancies);
    if (invalidPos) {
        return res.status(400).json({ success: false, message: 'Job Title, Department, and Vacancies are required for every position.' });
    }

    // Server-side manager verification — never trust the frontend's redirect alone,
    // since this endpoint could otherwise be called directly (e.g. via Postman/curl).
    const roleCheckQuery = `SELECT position FROM users WHERE LOWER(user_id) = LOWER(?)`;
    db.query(roleCheckQuery, [requester_id], (roleErr, roleResults) => {
        if (roleErr) {
            console.error('Recruitment Role Check Error:', roleErr);
            return res.status(500).json({ success: false, message: 'Database error verifying requester role.' });
        }

        const dbPosition = (roleResults[0] && roleResults[0].position) || '';
        const isManager = requester_id.toUpperCase().startsWith('MGR') ||
                          /manager/i.test(dbPosition);

        if (!isManager) {
            return res.status(403).json({ success: false, message: 'Access Denied: Only managers can submit a recruitment requisition.' });
        }

        submitRecruitment(req, res);
    });
});

function submitRecruitment(req, res) {
    const {
        requested_by, requester_id, requester_department,
        requester_position, request_date, positions
    } = req.body;

    const parentQuery = `
        INSERT INTO \`recruitment_requests\`
        (\`requested_by\`, \`requester_id\`, \`requester_department\`, \`requester_position\`, \`request_date\`, \`status\`, \`created_at\`)
        VALUES (?, ?, ?, ?, ?, 'Pending', NOW())
    `;

    db.query(parentQuery, [
        requested_by || null,
        requester_id,
        requester_department || null,
        requester_position || null,
        request_date || null
    ], (err, parentResult) => {
        if (err) {
            console.error('Recruitment Request SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }

        const requestId = parentResult.insertId;

        const positionsQuery = `
            INSERT INTO \`recruitment_positions\`
            (\`request_id\`, \`job_title\`, \`department\`, \`employment_type\`, \`vacancies\`, \`position_type\`,
             \`reporting_to\`, \`qualification\`, \`experience\`, \`skills\`, \`job_description\`,
             \`salary_min\`, \`salary_max\`, \`budget\`, \`benefits\`, \`justification\`)
            VALUES ?
        `;

        const positionValues = positions.map(p => [
            requestId,
            p.job_title,
            p.department || null,
            p.employment_type || null,
            parseInt(p.vacancies, 10) || 1,
            p.position_type || null,
            p.reporting_to || null,
            p.qualification || null,
            p.experience || null,
            p.skills || null,
            p.job_description || null,
            p.salary_min || null,
            p.salary_max || null,
            p.budget || null,
            p.benefits || null,
            p.justification || null
        ]);

        db.query(positionsQuery, [positionValues], (posErr) => {
            if (posErr) {
                console.error('Recruitment Positions SQL Error:', posErr);
                return res.status(500).json({ success: false, message: 'Failed to save position details: ' + posErr.message });
            }
            return res.json({ success: true, message: 'Recruitment requisition submitted successfully!', requestId });
        });
    });
}

module.exports = router;