const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');

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