const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ==========================================================================
// API ROUTE: LIST PENDING PROBATION CONFIRMATIONS FOR THE LOGGED-IN MANAGER
// GET /api/probation-confirmation/list?user_id=MGR001&page=1
//
// The manager's department is looked up from the `users` table (never
// trusted from the frontend), then used to filter which probation
// confirmation records they're allowed to see and act on — i.e. only
// records where the EMPLOYEE being assessed belongs to that manager's
// department, and the record is still awaiting a decision.
// ==========================================================================
router.get('/api/probation-confirmation/list', (req, res) => {
    const userId = req.query.user_id;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'user_id is required.' });
    }

    // Step 1: resolve the requesting user's role/department from the database.
    const roleQuery = `SELECT department, position FROM users WHERE LOWER(user_id) = LOWER(?)`;

    db.query(roleQuery, [userId], (roleErr, roleResults) => {
        if (roleErr) {
            console.error('Probation List - Role Lookup Error:', roleErr);
            return res.status(500).json({ success: false, message: 'Database error verifying user role.' });
        }
        if (roleResults.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const userDept = roleResults[0].department || '';
        const userPos = (roleResults[0].position || '').toLowerCase();
        const isManager = userId.toUpperCase().startsWith('MGR') || /manager|head|hod/i.test(userPos);

        // CEO / top management see every pending record; a department
        // manager only sees records for employees in their own department.
        const isTopManagement = /ceo|management/i.test(userPos);

        if (!isManager) {
            return res.status(403).json({ success: false, message: 'Access Denied: Only managers can view this list.' });
        }

        // Step 2: pull the matching records from the actual table.
        let listQuery = `
            SELECT id, employee_id, employee_name, employee_department, created_at, status
            FROM \`probation_confirmations_hr\`
            WHERE status = 'Pending'
        `;
        const params = [];

        if (!isTopManagement) {
            listQuery += ` AND LOWER(TRIM(employee_department)) = LOWER(TRIM(?))`;
            params.push(userDept);
        }

        listQuery += ` ORDER BY created_at DESC`;

        db.query(listQuery, params, (listErr, results) => {
            if (listErr) {
                console.error('Probation List - Query Error:', listErr);
                return res.status(500).json({ success: false, message: 'Database error fetching list: ' + listErr.message });
            }

            const records = results.map(row => {
                const created = new Date(row.created_at);
                const submittedDate = created.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                const submittedTime = created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();

                return {
                    id: row.id,
                    name: row.employee_name,
                    submittedDate,
                    submittedTime
                };
            });

            return res.json({ success: true, records, total: records.length });
        });
    });
});

module.exports = router;