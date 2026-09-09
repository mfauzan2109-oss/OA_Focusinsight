const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');
const { isWeekend, countBusinessDays } = require('../utils/helpers');

// ==========================================================================
// API ROUTE: SUBMIT LEAVE APPLICATION
// ==========================================================================
router.post('/api/submit-leave', upload.single('attachment'), (req, res) => {
    const employee_id   = req.body.employee_id;
    const employee_name = req.body.employee_name;
    const department    = req.body.department;
    
    let leave_type = req.body.leave_type;
    if (leave_type === 'others' && req.body.leave_type_others) {
        leave_type = req.body.leave_type_others;
    }
    
    const start_date = req.body.start_date;
    const end_date   = req.body.end_date;
    const day_type   = req.body.day_type;
    const reason     = req.body.reason;
    const attachment_path = req.file ? `uploads/${req.file.filename}` : null;

    if (!employee_id || !start_date || !end_date) {
        return res.status(400).json({ success: false, message: 'Employee ID, Start Date, and End Date are required.' });
    }

    const startObj = new Date(start_date);
    const endObj = new Date(end_date);

    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime()) || endObj < startObj) {
        return res.status(400).json({ success: false, message: 'Invalid date range provided.' });
    }

    if (isWeekend(startObj) || isWeekend(endObj)) {
        return res.status(400).json({ success: false, message: 'Weekends are excluded from leave. Please select a Start Date and End Date that fall on a weekday.' });
    }

    let num_days = countBusinessDays(start_date, end_date);
    if ((day_type === 'half-am' || day_type === 'half-pm') && start_date === end_date) {
        num_days = 0.5;
    }

    if (num_days <= 0) {
        return res.status(400).json({ success: false, message: 'The selected date range contains no working days (weekends are excluded).' });
    }

    const overlapQuery = `
        SELECT ID as id, \`Start Date\` as start_date, \`End Date\` as end_date, Status as status
        FROM \`leave\`
        WHERE LOWER(\`Employee ID\`) = LOWER(?)
          AND LOWER(Status) IN ('pending', 'approved')
          AND \`Start Date\` <= ?
          AND \`End Date\` >= ?
    `;

    db.query(overlapQuery, [employee_id, end_date, start_date], (overlapErr, overlapResults) => {
        if (overlapErr) {
            console.error('Overlap Check SQL Error:', overlapErr);
            return res.status(500).json({ success: false, message: 'Database Error: ' + overlapErr.message });
        }

        if (overlapResults && overlapResults.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'You already have a leave request that overlaps with these dates. Duplicate leave applications are not allowed.'
            });
        }

        const query = `
            INSERT INTO \`leave\` 
            (\`Employee ID\`, \`Employee Name\`, \`Department\`, \`Leave Type\`, \`Start Date\`, \`End Date\`, \`Day type\`, \`No of Days\`, \`Reason\`, \`Supporting Documen\`, \`Status\`, \`Created At\`) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())
        `;

        db.query(query, [employee_id, employee_name, department, leave_type, start_date, end_date, day_type, num_days, reason, attachment_path], (err, result) => {
            if (err) {
                console.error('SQL Error:', err);
                return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
            }
            return res.json({ success: true, message: 'Leave application submitted successfully!' });
        });
    });
});

module.exports = router;
