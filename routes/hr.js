const express = require('express');
const router = express.Router();
const db = require('../config/db');
const requireHRAccess = require('../middleware/auth');
const upload = require('../middleware/upload');

// ==========================================================================
// HR DASHBOARD METRICS: DYNAMIC CALCULATIONS FROM DATABASE
// ==========================================================================
router.get('/api/hr/dashboard-stats', requireHRAccess, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const currentYearMonth = today.substring(0, 7);

    const usersCountSql = `SELECT COUNT(*) AS total_employees FROM users`;
    
    const pendingSql = `
        SELECT 
            (SELECT COUNT(*) FROM \`leave\` WHERE TRIM(Status) = 'Pending') +
            (SELECT COUNT(*) FROM disbursements WHERE TRIM(status) = 'Pending') +
            (SELECT COUNT(*) FROM travel WHERE TRIM(status) = 'Pending') +
            (SELECT COUNT(*) FROM overtime WHERE TRIM(status) = 'Pending') +
            (SELECT COUNT(*) FROM loans WHERE TRIM(status) = 'Pending') AS total_pending
    `;

    const approvedMonthSql = `
        SELECT 
            (SELECT COUNT(*) FROM \`leave\` WHERE LOWER(TRIM(Status)) LIKE '%approve%' AND DATE_FORMAT(\`Created At\`, '%Y-%m') = ?) +
            (SELECT COUNT(*) FROM disbursements WHERE LOWER(TRIM(status)) LIKE '%approve%' AND DATE_FORMAT(created_at, '%Y-%m') = ?) +
            (SELECT COUNT(*) FROM travel WHERE LOWER(TRIM(status)) LIKE '%approve%' AND DATE_FORMAT(created_at, '%Y-%m') = ?) +
            (SELECT COUNT(*) FROM overtime WHERE LOWER(TRIM(status)) LIKE '%approve%' AND DATE_FORMAT(created_at, '%Y-%m') = ?) +
            (SELECT COUNT(*) FROM loans WHERE LOWER(TRIM(status)) LIKE '%approve%' AND DATE_FORMAT(created_at, '%Y-%m') = ?) AS approved_month
    `;

    const leaveTodaySql = `
        SELECT COUNT(*) AS on_leave_today 
        FROM \`leave\` 
        WHERE LOWER(TRIM(Status)) LIKE '%approve%' 
          AND DATE(\`Start Date\`) <= ? 
          AND DATE(\`End Date\`) >= ?
    `;

    db.query(usersCountSql, (err1, uRes) => {
        db.query(pendingSql, (err2, pRes) => {
            db.query(approvedMonthSql, [currentYearMonth, currentYearMonth, currentYearMonth, currentYearMonth, currentYearMonth], (err3, aRes) => {
                db.query(leaveTodaySql, [today, today], (err4, lRes) => {
                    return res.json({
                        success: true,
                        data: {
                            total_employees: uRes[0]?.total_employees || 0,
                            pending_requests: pRes[0]?.total_pending || 0,
                            approved_month: aRes[0]?.approved_month || 0,
                            on_leave_today: lRes[0]?.on_leave_today || 0
                        }
                    });
                });
            });
        });
    });
});

// ==========================================================================
// HR DASHBOARD RECENT ACTIVITIES: COMBINED UNION OF ALL REQUEST TYPES
// ==========================================================================
router.get('/api/hr/recent-activities', requireHRAccess, (req, res) => {
    const leaveQuery = `SELECT ID as id, 'Leave' as request_type, \`Employee Name\` as employee_name, Department as department, 'Not Applicable' as amount, \`Created At\` as date_submitted, TRIM(Status) as status FROM \`leave\``;
    const disQuery   = `SELECT id, 'Disbursement' as request_type, employee_name, department, CONCAT('RM ', FORMAT(total_amount, 2)) as amount, created_at as date_submitted, TRIM(status) as status FROM disbursements`;
    const travelQuery = `SELECT id, 'Travel' as request_type, employee_name, department, CONCAT('RM ', FORMAT(total_amount, 2)) as amount, created_at as date_submitted, TRIM(status) as status FROM travel`;
    const otQuery    = `SELECT id, 'Overtime' as request_type, employee_name, department, CONCAT('RM ', FORMAT(total_claim, 2)) as amount, created_at as date_submitted, TRIM(status) as status FROM overtime`;
    const loanQuery  = `SELECT id, 'Loan' as request_type, employee_name, department, CONCAT('RM ', FORMAT(amount_requested, 2)) as amount, created_at as date_submitted, TRIM(status) as status FROM loans`;

    db.query(leaveQuery, (e1, lRes) => {
        db.query(disQuery, (e2, dRes) => {
            db.query(travelQuery, (e3, tRes) => {
                db.query(otQuery, (e4, oRes) => {
                    db.query(loanQuery, (e5, lnRes) => {
                        const allActivities = [
                            ...(lRes || []),
                            ...(dRes || []),
                            ...(tRes || []),
                            ...(oRes || []),
                            ...(lnRes || [])
                        ];

                        allActivities.forEach(row => {
                            if (row.date_submitted) {
                                try {
                                    row.date_submitted = new Date(row.date_submitted).toISOString().split('T')[0];
                                } catch (err) {}
                            } else {
                                row.date_submitted = '—';
                            }
                        });

                        allActivities.sort((a, b) => new Date(b.date_submitted) - new Date(a.date_submitted));

                        return res.json({ success: true, data: allActivities.slice(0, 50) });
                    });
                });
            });
        });
    });
});

// ==========================================================================
// HR PROTECTED ROUTES (HR PROCESSING & ACTIONS WITH REMINDERS)
// ==========================================================================
router.get('/api/hr/processing-lists', requireHRAccess, (req, res) => {
    // Select last_reminder_sent to detect and format reminder timestamps
    const disSql = `SELECT id, employee_id, employee_name, 'Disbursement Application' AS request_type, created_at, last_reminder_sent FROM disbursements WHERE status = 'Pending' OR status = 'PENDING'`;
    const loanSql = `SELECT id, employee_id, employee_name, 'Loan Application' AS request_type, created_at, last_reminder_sent FROM loans WHERE status = 'Pending' OR status = 'PENDING'`;
    const travelSql = `SELECT id, employee_id, employee_name, 'Travel Application' AS request_type, created_at, last_reminder_sent FROM travel WHERE status = 'Pending' OR status = 'PENDING'`;

    // Helper function to format relative time strings for reminders
    function formatTimeAgo(dateStr) {
        if (!dateStr) return null;
        const then = new Date(dateStr);
        const now = new Date();
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / (1000 * 60));

        if (diffMins < 1) return 'Reminder sent just now.';
        if (diffMins < 60) return `Reminder sent ${diffMins} minute${diffMins !== 1 ? 's' : ''} ago.`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Reminder sent ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago.`;
        const diffDays = Math.floor(diffHours / 24);
        return `Reminder sent ${diffDays} day${diffDays !== 1 ? 's' : ''} ago.`;
    }

// Test 1 minute ago
const test2 = new Date(Date.now() - 60 * 1000); 
console.log(formatTimeAgo(test2)); 
// Output: "Reminder sent 60 hours ago." -> which automatically flips to days!
    db.query(disSql, (err1, disRes) => {
        db.query(loanSql, (err2, loanRes) => {
            db.query(travelSql, (err3, travelRes) => {
                const mapItem = (r, tablePrefix, sourceTable) => {
                    const hasReminder = !!r.last_reminder_sent;
                    return {
                        ...r,
                        formatted_id: `REQ-${tablePrefix}-${String(r.id).padStart(3, '0')}`,
                        source_table: sourceTable,
                        has_reminder: hasReminder,
                        reminder_text: formatTimeAgo(r.last_reminder_sent)
                    };
                };

                const approvals = [
                    ...(disRes || []).map(r => mapItem(r, '2026', 'disbursements')),
                    ...(loanRes || []).map(r => mapItem(r, '2026', 'loans'))
                ];

                const bookings = (travelRes || []).map(r => mapItem(r, '2026', 'travel'));

                // Sort lists so requests with active reminders appear at the top for higher visibility
                const sortByReminder = (a, b) => {
                    if (a.has_reminder && !b.has_reminder) return -1;
                    if (!a.has_reminder && b.has_reminder) return 1;
                    if (a.last_reminder_sent && b.last_reminder_sent) {
                        return new Date(b.last_reminder_sent) - new Date(a.last_reminder_sent);
                    }
                    return 0;
                };

                approvals.sort(sortByReminder);
                bookings.sort(sortByReminder);

                return res.json({ 
                    success: true, 
                    pending_approvals: approvals, 
                    pending_bookings: bookings 
                });
            });
        });
    });
});

// ==========================================================================
// HR TRAVEL BOOKING SUBMISSION TO CEO
// ==========================================================================
router.post('/api/hr/submit-booking-to-ceo', upload.single('quotation_file'), requireHRAccess, (req, res) => {
    const { request_id, hr_flight_option, hr_hotel_option } = req.body;

    if (!request_id) {
        return res.status(400).json({ success: false, message: 'Request ID is missing.' });
    }

    const quotationPath = req.file ? `uploads/${req.file.filename}` : null;
    let query = `UPDATE travel SET status = 'Pending CEO Approval'`;
    const params = [];

    if (quotationPath) {
        query += `, supporting_document = ?`;
        params.push(quotationPath);
    }

    query += ` WHERE id = ?`;
    params.push(request_id);

    db.query(query, params, (err, result) => {
        if (err) {
            console.error('Submit Booking To CEO Error:', err);
            return res.status(500).json({ success: false, message: 'Failed to forward booking to CEO: ' + err.message });
        }
        return res.json({ success: true, message: 'Booking details verified and forwarded to CEO successfully!' });
    });
});

module.exports = router;
