const express = require('express');

const db = require('../config/database');

const router = express.Router();

router.get('/api/notifications', (req, res) => {
    const userId = req.query.employee_id;
    const userDept = (req.query.department || '').trim();
    const userPos = (req.query.position || '').trim().toLowerCase();

    if (!userId) {
        return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    }

    const isApprover = userPos.includes('ceo') || userPos.includes('manager') || userPos.includes('supervisor') ||
                        userDept.toLowerCase() === 'management' || userId.toUpperCase().startsWith('CEO');

    // --- Notifications about MY OWN submitted requests (status changes + my own reminders) ---
    let leaveQuery  = `SELECT ID as id, 'Leave' as request_type, \`Leave Type\` as details, Status as status, \`Created At\` as created_at, last_reminder_sent, \`Employee Name\` as employee_name FROM \`leave\` WHERE LOWER(\`Employee ID\`) = LOWER(?)`;
    let disQuery    = `SELECT id, 'Disbursement' as request_type, 'Expense Claim' as details, status, created_at, last_reminder_sent, employee_name FROM \`disbursements\` WHERE LOWER(\`employee_id\`) = LOWER(?)`;
    let travelQuery = `SELECT id, 'Travel' as request_type, allowance_type as details, status, created_at, last_reminder_sent, employee_name FROM \`travel\` WHERE LOWER(\`employee_id\`) = LOWER(?)`;
    let otQuery     = `SELECT id, 'Overtime' as request_type, CONCAT('OT Claim (', period, ')') as details, status, created_at, last_reminder_sent, employee_name FROM \`overtime\` WHERE LOWER(\`employee_id\`) = LOWER(?)`;
    let loanQuery   = `SELECT id, 'Loan' as request_type, CONCAT(loan_type, ' Loan') as details, status, created_at, last_reminder_sent, employee_name FROM \`loans\` WHERE LOWER(\`employee_id\`) = LOWER(?)`;

    db.query(leaveQuery, [userId], (err1, leaveResults) => {
        db.query(disQuery, [userId], (err2, disResults) => {
            db.query(travelQuery, [userId], (err3, travelResults) => {
                db.query(otQuery, [userId], (err4, otResults) => {
                    db.query(loanQuery, [userId], (err5, loanResults) => {
                        const notifications = [];

                        const combine = [
                            ...(leaveResults || []),
                            ...(disResults || []),
                            ...(travelResults || []),
                            ...(otResults || []),
                            ...(loanResults || [])
                        ];

                        combine.forEach(item => {
                            let formattedDate = '—';
                            if (item.created_at) {
                                try { 
                                    formattedDate = new Date(item.created_at).toISOString().split('T')[0]; 
                                } catch(e) {}
                            }

                            const itemStatus = (item.status || 'Pending').trim();
                            const formNo = `REQ-${item.request_type.toUpperCase()}-${item.id}`;

                            notifications.push({
                                id: item.id,
                                type: item.request_type,
                                form_no: formNo,
                                status: itemStatus.charAt(0).toUpperCase() + itemStatus.slice(1).toLowerCase(),
                                time: formattedDate,
                                is_reminder: false
                            });

                            // Self-confirmation: "You sent a reminder for this request"
                            if (item.last_reminder_sent) {
                                let reminderTime = '—';
                                try { reminderTime = new Date(item.last_reminder_sent).toISOString().split('T')[0]; } catch(e) {}

                                notifications.push({
                                    id: item.id,
                                    type: item.request_type,
                                    form_no: formNo,
                                    status: 'Pending',
                                    time: reminderTime,
                                    is_reminder: true,
                                    employee_name: item.employee_name || 'You',
                                    message: `${item.employee_name || 'You'}: Reminder sent`
                                });
                            }
                        });

                        // --- If this user is a Manager/CEO/Supervisor, ALSO surface reminders  ---
                        // --- sent BY staff whose pending requests are awaiting THIS approver.   ---
                        if (!isApprover) {
                            notifications.sort((a, b) => {
                                if (a.time === '—') return 1;
                                if (b.time === '—') return -1;
                                return b.time.localeCompare(a.time);
                            });
                            return res.json({ success: true, notifications });
                        }

                        const isGlobalApprover = userPos.includes('ceo') || userDept.toLowerCase() === 'management' || userId.toUpperCase().startsWith('CEO');
                        const deptParams = isGlobalApprover ? [] : [userDept];
                        const deptClause = isGlobalApprover ? '' : ` AND LOWER(TRIM(department)) = LOWER(TRIM(?))`;
                        const deptClauseLeave = isGlobalApprover ? '' : ` AND LOWER(TRIM(Department)) = LOWER(TRIM(?))`;

                        const rLeaveQuery  = `SELECT ID as id, 'Leave' as request_type, \`Employee Name\` as employee_name, \`Created At\` as created_at, last_reminder_sent FROM \`leave\` WHERE TRIM(Status) = 'Pending' AND last_reminder_sent IS NOT NULL${deptClauseLeave}`;
                        const rDisQuery    = `SELECT id, 'Disbursement' as request_type, employee_name, created_at, last_reminder_sent FROM \`disbursements\` WHERE TRIM(status) = 'Pending' AND last_reminder_sent IS NOT NULL${deptClause}`;
                        const rTravelQuery = `SELECT id, 'Travel' as request_type, employee_name, created_at, last_reminder_sent FROM \`travel\` WHERE TRIM(status) = 'Pending' AND last_reminder_sent IS NOT NULL${deptClause}`;
                        const rOtQuery     = `SELECT id, 'Overtime' as request_type, employee_name, created_at, last_reminder_sent FROM \`overtime\` WHERE TRIM(status) = 'Pending' AND last_reminder_sent IS NOT NULL${deptClause}`;
                        const rLoanQuery   = `SELECT id, 'Loan' as request_type, employee_name, created_at, last_reminder_sent FROM \`loans\` WHERE TRIM(status) = 'Pending' AND last_reminder_sent IS NOT NULL${deptClause}`;

                        db.query(rLeaveQuery, deptParams, (rErr1, rLeaveResults) => {
                            db.query(rDisQuery, deptParams, (rErr2, rDisResults) => {
                                db.query(rTravelQuery, deptParams, (rErr3, rTravelResults) => {
                                    db.query(rOtQuery, deptParams, (rErr4, rOtResults) => {
                                        db.query(rLoanQuery, deptParams, (rErr5, rLoanResults) => {
                                            const reminderRows = [
                                                ...(rLeaveResults || []),
                                                ...(rDisResults || []),
                                                ...(rTravelResults || []),
                                                ...(rOtResults || []),
                                                ...(rLoanResults || [])
                                            ];

                                            reminderRows.forEach(item => {
                                                let reminderTime = '—';
                                                try { reminderTime = new Date(item.last_reminder_sent).toISOString().split('T')[0]; } catch(e) {}

                                                notifications.push({
                                                    id: item.id,
                                                    type: item.request_type,
                                                    form_no: `REQ-${item.request_type.toUpperCase()}-${item.id}`,
                                                    status: 'Pending',
                                                    time: reminderTime,
                                                    is_reminder: true,
                                                    employee_name: item.employee_name,
                                                    message: `${item.employee_name}: Reminder sent`
                                                });
                                            });

                                            notifications.sort((a, b) => {
                                                if (a.time === '—') return 1;
                                                if (b.time === '—') return -1;
                                                return b.time.localeCompare(a.time);
                                            });

                                            return res.json({ success: true, notifications });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

router.post('/api/login', (req, res) => {
    const { user_id, password } = req.body;

    const query = `
        SELECT *
        FROM users
        WHERE LOWER(user_id) = LOWER(?)
        LIMIT 1
    `;

    db.query(query, [user_id], (err, results) => {
        if (err) {
            console.error('Database query error:', err);

            return res.status(500).json({
                success: false,
                message: 'Server database error.'
            });
        }

        if (!results || results.length === 0) {
            return res.json({
                success: false,
                message: 'Employee ID not found.'
            });
        }

        const user = results[0];

        if (user.password !== password) {
            return res.json({
                success: false,
                message: 'Incorrect password.'
            });
        }

        // Save authenticated identity on the server
        req.session.user = {
            user_id: user.user_id,
            name: user.name,
            position: user.position,
            department: user.department,
            company_name: user.company_name
        };

        req.session.save((sessionErr) => {
            if (sessionErr) {
                console.error('Session save error:', sessionErr);

                return res.status(500).json({
                    success: false,
                    message: 'Failed to create login session.'
                });
            }

            return res.json({
                success: true,
                user_id: user.user_id,
                name: user.name,
                position: user.position,
                department: user.department,
                company_name: user.company_name
            });
        });
    });
});

// ==========================================================================
// GET CURRENT LOGGED-IN USER
// ==========================================================================
router.get('/api/me', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Not authenticated.'
        });
    }

    return res.json({
        success: true,
        user: req.session.user
    });
});


// ==========================================================================
// LOGOUT
// ==========================================================================
router.post('/api/logout', (req, res) => {
    if (!req.session) {
        return res.json({
            success: true,
            message: 'Already logged out.'
        });
    }

    req.session.destroy((err) => {
        if (err) {
            console.error('Logout Session Error:', err);

            return res.status(500).json({
                success: false,
                message: 'Failed to logout.'
            });
        }

        res.clearCookie('connect.sid');

        return res.json({
            success: true,
            message: 'Logged out successfully.'
        });
    });
});

module.exports = router;
