const express = require('express');
const router = express.Router();
const db = require('../config/database');
const upload = require('../middleware/upload');

// ==========================================================================
// LEGACY FORMS — carried over from the pre-refactor version
// (recruitment requisition, manpower outsourcing, resignation,
// India e-business visa application). Consolidated here rather than as
// four separate files to match this project's domain-grouped route style.
// ==========================================================================

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

// ==========================================================================
// API ROUTE: SUBMIT RESIGNATION FORM
// ==========================================================================
router.post('/api/submit-resignation', upload.single('attachment'), (req, res) => {
    const {
        requested_by, request_date, request_department,
        employee_id, employee_name, department, position,
        employment_type, employment_date, last_working_date,
        notice_date, notice_period, reason, hr_remarks
    } = req.body;

    if (!employee_id) {
        return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    }

    const attachment_path = req.file ? `uploads/${req.file.filename}` : null;

    const query = `
        INSERT INTO \`resignations\`
        (\`requested_by\`, \`request_date\`, \`request_department\`, \`employee_id\`, \`employee_name\`,
         \`department\`, \`position\`, \`employment_type\`, \`employment_date\`, \`last_working_date\`,
         \`notice_date\`, \`notice_period\`, \`reason\`, \`hr_remarks\`, \`supporting_document\`,
         \`status\`, \`created_at\`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())
    `;

    db.query(query, [
        requested_by || null,
        request_date || null,
        request_department || null,
        employee_id,
        employee_name || null,
        department || null,
        position || null,
        employment_type || null,
        employment_date || null,
        last_working_date || null,
        notice_date || null,
        notice_period || null,
        reason || null,
        hr_remarks || null,
        attachment_path
    ], (err, result) => {
        if (err) {
            console.error('Resignation SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }
        return res.json({ success: true, message: 'Resignation form submitted successfully!' });
    });
});

// ==========================================================================
// API ROUTE: SUBMIT INDIAN E-BUSINESS VISA APPLICATION
// ==========================================================================
router.post('/api/submit-india-visa-application',
    upload.fields([
        { name: 'photo', maxCount: 1 },
        { name: 'passport_page', maxCount: 1 },
        { name: 'invitation_letter', maxCount: 1 }
    ]),
    (req, res) => {
        const b = req.body;

        if (!b.employee_id) {
            return res.status(400).json({ success: false, message: 'Employee ID is required.' });
        }

        const requiredFields = [
            'ic_passport_no', 'phone_no', 'religion', 'edu_qualification', 'course_qualification',
            'port_of_arrival', 'present_address',
            'father_full_name', 'father_nationality', 'father_country_of_birth',
            'mother_full_name', 'mother_nationality', 'mother_country_of_birth',
            'marital_status', 'visited_india_before', 'permission_refused'
        ];
        const missing = requiredFields.find(f => !b[f]);
        if (missing) {
            return res.status(400).json({ success: false, message: `Missing required field: ${missing}` });
        }

        if (b.visited_india_before === 'Yes' && (!b.address_of_stay || !b.visa_no || !b.visa_type || !b.date_of_issue)) {
            return res.status(400).json({ success: false, message: 'Please complete all required Previous India Visit fields.' });
        }
        if (b.permission_refused === 'Yes' && (!b.control_no || !b.refusal_date || !b.refused_by_authority)) {
            return res.status(400).json({ success: false, message: 'Please complete all required fields about the refused permission.' });
        }

        const files = req.files || {};
        if (!files.photo || !files.passport_page || !files.invitation_letter) {
            return res.status(400).json({ success: false, message: 'All 3 supporting documents are required.' });
        }

        const photoPath = `uploads/${files.photo[0].filename}`;
        const passportPath = `uploads/${files.passport_page[0].filename}`;
        const invitationPath = `uploads/${files.invitation_letter[0].filename}`;

        const query = `
            INSERT INTO \`india_visa_applications\`
            (\`employee_id\`, \`full_name\`, \`department\`, \`position\`, \`ic_passport_no\`, \`phone_no\`,
             \`company_email\`, \`religion\`, \`edu_qualification\`, \`course_qualification\`,
             \`port_of_arrival\`, \`present_address\`, \`permanent_address\`,
             \`father_full_name\`, \`father_nationality\`, \`father_prev_nationality\`, \`father_place_of_birth\`, \`father_country_of_birth\`,
             \`mother_full_name\`, \`mother_nationality\`, \`mother_prev_nationality\`, \`mother_place_of_birth\`, \`mother_country_of_birth\`,
             \`marital_status\`, \`spouse_name\`, \`spouse_nationality\`, \`spouse_prev_nationality\`, \`spouse_place_of_birth\`, \`spouse_country_of_birth\`,
             \`visited_india_before\`, \`address_of_stay\`, \`city_visited\`, \`visa_no\`, \`visa_type\`, \`place_of_issue\`, \`date_of_issue\`,
             \`permission_refused\`, \`control_no\`, \`refusal_date\`, \`refused_by_authority\`, \`refusal_remarks\`,
             \`photo_document\`, \`passport_page_document\`, \`invitation_letter_document\`,
             \`status\`, \`created_at\`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())
        `;

        db.query(query, [
            b.employee_id, b.full_name || null, b.department || null, b.position || null,
            b.ic_passport_no, b.phone_no, b.company_email || null, b.religion,
            b.edu_qualification, b.course_qualification,
            b.port_of_arrival, b.present_address, b.permanent_address || null,
            b.father_full_name, b.father_nationality, b.father_prev_nationality || null, b.father_place_of_birth || null, b.father_country_of_birth,
            b.mother_full_name, b.mother_nationality, b.mother_prev_nationality || null, b.mother_place_of_birth || null, b.mother_country_of_birth,
            b.marital_status, b.spouse_name || null, b.spouse_nationality || null, b.spouse_prev_nationality || null, b.spouse_place_of_birth || null, b.spouse_country_of_birth || null,
            b.visited_india_before, b.address_of_stay || null, b.city_visited || null, b.visa_no || null, b.visa_type || null, b.place_of_issue || null, b.date_of_issue || null,
            b.permission_refused, b.control_no || null, b.refusal_date || null, b.refused_by_authority || null, b.refusal_remarks || null,
            photoPath, passportPath, invitationPath
        ], (err, result) => {
            if (err) {
                console.error('India Visa Application SQL Error:', err);
                return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
            }
            return res.json({ success: true, message: 'Indian E-Business Visa Application submitted successfully!', id: result.insertId });
        });
    }
);

module.exports = router;
