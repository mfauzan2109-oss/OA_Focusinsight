const express = require('express');

const db = require('../config/database');
const upload = require('../middleware/upload');
const { requireLogin } = require('../middleware/auth');
const { getAnnualEntitlement, getSickEntitlement, isWeekend, countBusinessDays } = require('../utils/helpers');
const { saveWithApprovalSteps } = require('../utils/p1-workflow');

const router = express.Router();

router.get('/api/user-leave-info', requireLogin, (req, res) => {
    const userId = req.session.user.user_id;

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

router.get('/api/leave-balance', requireLogin, (req, res) => {
    const employeeId = req.session.user.user_id;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    const balanceQuery = `
        SELECT
            leave_type,
            entitlement,
            carried_forward,
            carried_forward_expires
        FROM leave_balances
        WHERE LOWER(employee_id) = LOWER(?)
          AND year = ?
        ORDER BY FIELD(
            leave_type,
            'Annual Leave',
            'Sick Leave',
            'Hospitalization',
            'Maternity',
            'Paternity'
        )
    `;

    db.query(balanceQuery, [employeeId, year], (balanceErr, balances) => {
        if (balanceErr) {
            console.error('Leave balance query error:', balanceErr);
            return res.status(500).json({
                success: false,
                message: 'Failed to load leave balance.'
            });
        }

        const usedQuery = `
            SELECT
                CASE
                    WHEN LOWER(TRIM(\`Leave Type\`)) IN ('annual', 'annual leave')
                        THEN 'Annual Leave'
                    WHEN LOWER(TRIM(\`Leave Type\`)) IN ('sick', 'sick leave')
                        THEN 'Sick Leave'
                    WHEN LOWER(TRIM(\`Leave Type\`)) IN ('hospitalization', 'medical leave')
                        THEN 'Hospitalization'
                    WHEN LOWER(TRIM(\`Leave Type\`)) = 'maternity'
                        THEN 'Maternity'
                    WHEN LOWER(TRIM(\`Leave Type\`)) = 'paternity'
                        THEN 'Paternity'
                    ELSE NULL
                END AS leave_type,
                SUM(\`No of Days\`) AS used
            FROM \`leave\`
            WHERE LOWER(\`Employee ID\`) = LOWER(?)
              AND YEAR(\`Start Date\`) = ?
              AND LOWER(TRIM(\`Status\`)) NOT IN ('rejected', 'cancelled')
            GROUP BY leave_type
        `;

        db.query(usedQuery, [employeeId, year], (usedErr, usedRows) => {
            if (usedErr) {
                console.error('Leave usage query error:', usedErr);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to calculate leave usage.'
                });
            }

            const usedMap = {};

            (usedRows || []).forEach(row => {
                if (row.leave_type) {
                    usedMap[row.leave_type] = Number(row.used || 0);
                }
            });

            const today = new Date();

            const data = (balances || []).map(row => {
                const entitlement = Number(row.entitlement || 0);

                let carriedForward = Number(row.carried_forward || 0);

                if (
                    row.carried_forward_expires &&
                    new Date(row.carried_forward_expires) < today
                ) {
                    carriedForward = 0;
                }

                const used = usedMap[row.leave_type] || 0;
                const remaining = Math.max(
                    0,
                    entitlement + carriedForward - used
                );

                return {
                    leave_type: row.leave_type,
                    entitlement,
                    carried_forward: carriedForward,
                    used,
                    remaining
                };
            });

            return res.json({
                success: true,
                year,
                data
            });
        });
    });
});

router.get('/api/public-holidays', requireLogin, (req, res) => {
    const query = `
        SELECT
            holiday_date,
            holiday_name
        FROM public_holidays
        ORDER BY holiday_date
    `;

    db.query(query, [], (err, rows) => {
        if (err) {
            console.error('Public holidays query error:', err);
            return res.status(500).json({
                success: false,
                message: 'Failed to load public holidays.'
            });
        }

        return res.json({
            success: true,
            data: rows
        });
    });
});

router.post('/api/submit-leave', requireLogin, upload.single('attachment'), (req, res) => {
    const employee_id = req.session.user.user_id;
    const employee_name = req.session.user.name;
    const department = req.session.user.department;

    let leave_type = req.body.leave_type;
    if (leave_type === 'others' && req.body.leave_type_others) {
        leave_type = req.body.leave_type_others;
    }

    const start_date = req.body.start_date;
    const end_date = req.body.end_date;
    const day_type = req.body.day_type;
    const reason = req.body.reason;
    const attachment_path = req.file ? `uploads/${req.file.filename}` : null;

    if (!start_date || !end_date) {
        return res.status(400).json({
            success: false,
            message: 'Start Date and End Date are required.'
        });
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

        const roles = ['Head of Department'];

        if (num_days > 3) {
            roles.push('VGM');
        }

        if (num_days > 5) {
            roles.push('CEO', 'Chairman');
        }

        roles.push('HR');

        saveWithApprovalSteps({
            type: 'leave',
            insertQuery: query,
            values: [
                employee_id,
                employee_name,
                department,
                leave_type,
                start_date,
                end_date,
                day_type,
                num_days,
                reason,
                attachment_path
            ],
            roles,
            department
        })
            .then(result => {
                return res.json({
                    success: true,
                    id: result.insertId,
                    message: 'Leave application submitted successfully!'
                });
            })
            .catch(err => {
                console.error('Leave workflow error:', err);

                return res.status(500).json({
                    success: false,
                    message: 'Failed to submit leave application.'
                });
            });
    });
});

module.exports = router;