const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');

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

module.exports = router;