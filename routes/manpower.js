const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');

// ==========================================================================
// API ROUTE: SUBMIT MANPOWER OUTSOURCING REQUEST
// ==========================================================================
// Each position may have its own supporting document, sent as separate
// fields (supporting_document_0, supporting_document_1, ...) matching the
// position's index in the `positions` array — so we use upload.any() here
// instead of a single fixed field name.
router.post('/api/submit-manpower-outsourcing', upload.any(), (req, res) => {
    const { requested_by, requester_id, requester_department, requester_position, request_date } = req.body;

    if (!requester_id) {
        return res.status(400).json({ success: false, message: 'Requester ID is required.' });
    }

    let positions;
    try {
        positions = JSON.parse(req.body.positions || '[]');
    } catch (parseErr) {
        return res.status(400).json({ success: false, message: 'Invalid format for positions data.' });
    }

    if (!Array.isArray(positions) || positions.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one position is required.' });
    }

    const requiredFields = [
        'outsourcing_agency', 'job_title', 'start_date', 'end_date', 'period', 'num_workers',
        'working_hours', 'work_location', 'reason_for_outsourcing',
        'job_description', 'key_responsibilities', 'min_qualification', 'required_skills', 'required_experience',
        'est_monthly_cost_per_worker', 'est_monthly_manpower_cost', 'budget_cost_center', 'estimated_cost', 'request_priority'
    ];
    const invalidPos = positions.find(p => requiredFields.some(field => !p[field]));
    if (invalidPos) {
        return res.status(400).json({ success: false, message: 'Please complete every required field for every position.' });
    }

    // Match each uploaded file back to its position by field name (supporting_document_0, _1, ...)
    const filesByIndex = {};
    (req.files || []).forEach(file => {
        const match = file.fieldname.match(/^supporting_document_(\d+)$/);
        if (match) {
            filesByIndex[match[1]] = `uploads/${file.filename}`;
        }
    });

    const parentQuery = `
        INSERT INTO \`manpower_outsourcing_requests\`
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
            console.error('Manpower Outsourcing Request SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }

        const requestId = parentResult.insertId;

        const positionsQuery = `
            INSERT INTO \`manpower_outsourcing_positions\`
            (\`request_id\`, \`outsourcing_agency\`, \`job_title\`, \`start_date\`, \`end_date\`, \`period\`,
             \`num_workers\`, \`working_hours\`, \`work_location\`, \`reason_for_outsourcing\`,
             \`job_description\`, \`key_responsibilities\`, \`min_qualification\`, \`required_skills\`, \`required_experience\`,
             \`est_monthly_cost_per_worker\`, \`est_monthly_manpower_cost\`, \`budget_cost_center\`,
             \`estimated_cost\`, \`request_priority\`, \`supporting_document\`)
            VALUES ?
        `;

        const positionValues = positions.map((p, idx) => [
            requestId,
            p.outsourcing_agency,
            p.job_title,
            p.start_date,
            p.end_date,
            p.period,
            parseInt(p.num_workers, 10) || 1,
            p.working_hours,
            p.work_location,
            p.reason_for_outsourcing,
            p.job_description,
            p.key_responsibilities,
            p.min_qualification,
            p.required_skills,
            p.required_experience,
            parseFloat(p.est_monthly_cost_per_worker) || null,
            parseFloat(p.est_monthly_manpower_cost) || null,
            p.budget_cost_center,
            parseFloat(p.estimated_cost) || null,
            p.request_priority,
            filesByIndex[idx] || null
        ]);

        db.query(positionsQuery, [positionValues], (posErr) => {
            if (posErr) {
                console.error('Manpower Outsourcing Positions SQL Error:', posErr);
                return res.status(500).json({ success: false, message: 'Failed to save position details: ' + posErr.message });
            }
            return res.json({ success: true, message: 'Manpower outsourcing request submitted successfully!', requestId });
        });
    });
});

module.exports = router;