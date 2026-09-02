const express = require('express');

const db = require('../config/database');
const upload = require('../middleware/upload');
const { getAnnualEntitlement, getSickEntitlement, isWeekend, countBusinessDays } = require('../utils/helpers');

const router = express.Router();

router.get('/api/user-leave-info', (req, res) => {
    const userId = req.query.employee_id;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    }

    const userQuery = 'SELECT join_date FROM users WHERE LOWER(user_id) = LOWER(?)';

    db.query(userQuery, [userId], (err, userResults) => {
        let yearsOfService = 1;

        if (!err && userResults.length > 0 && userResults[0].join_date) {
            const joinDate = new Date(userResults[0].join_date);
            const now = new Date();
            const diffTime = Math.abs(now - joinDate);
            yearsOfService = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25)));
        }

        const annualEntitlement = getAnnualEntitlement(yearsOfService);
        const sickEntitlement = getSickEntitlement(yearsOfService);
        const hospitalEntitlement = 60;

        const leaveQuery = `
            SELECT \`Leave Type\` as leave_type, \`No of Days\` as num_days, \`Start Date\` as start_date, \`End Date\` as end_date, Status
            FROM \`leave\`
            WHERE LOWER(\`Employee ID\`) = LOWER(?) AND LOWER(TRIM(Status)) != 'rejected'
        `;

        db.query(leaveQuery, [userId], (leaveErr, leaveResults) => {
            if (leaveErr) {
                console.error('Fetch Leave Balance Error:', leaveErr);
                return res.status(500).json({ success: false, message: 'Database error.' });
            }

            let usedAnnual = 0;
            let usedSick = 0;
            let usedHospital = 0;
            const bookedDates = [];

            (leaveResults || []).forEach(row => {
                const days = parseFloat(row.num_days || 0);
                const lType = (row.leave_type || '').toLowerCase();

                if (lType.includes('annual')) usedAnnual += days;
                else if (lType.includes('sick')) usedSick += days;
                else if (lType.includes('hospital')) usedHospital += days;

                if (row.start_date && row.end_date) {
                    let cur = new Date(row.start_date);
                    const end = new Date(row.end_date);
                    while (cur <= end) {
                        bookedDates.push(cur.toISOString().split('T')[0]);
                        cur.setDate(cur.getDate() + 1);
                    }
                }
            });

            return res.json({
                success: true,
                yearsOfService: yearsOfService,
                usedAnnualLeave: usedAnnual,
                bookedDates: bookedDates,
                balances: {
                    annual: {
                        entitlement: annualEntitlement,
                        used: usedAnnual,
                        remaining: Math.max(0, annualEntitlement - usedAnnual)
                    },
                    sick: {
                        entitlement: sickEntitlement,
                        used: usedSick,
                        remaining: Math.max(0, sickEntitlement - usedSick)
                    },
                    hospitalization: {
                        entitlement: hospitalEntitlement,
                        used: usedHospital,
                        remaining: Math.max(0, hospitalEntitlement - usedHospital)
                    }
                }
            });
        });
    });
});

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
