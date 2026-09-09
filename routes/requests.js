const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { normalizeFilePath } = require('../utils/helpers');

// ==========================================================================
// API ROUTE: FETCH FULL REQUEST DETAILS FOR A SINGLE RECORD
// ==========================================================================
router.get('/api/request-details', (req, res) => {
    const { id, type } = req.query;

    if (!id || !type) {
        return res.status(400).json({ success: false, message: 'Both Request ID and Type parameters are required.' });
    }

    let query = '';
    const reqType = type.toLowerCase();

    // 1. Join form tables with users table to fetch email & phone number
    if (reqType.includes('leave')) {
        query = `SELECT l.*, u.phone_no, u.email FROM \`leave\` l LEFT JOIN users u ON LOWER(l.\`Employee ID\`) = LOWER(u.user_id COLLATE utf8mb4_general_ci) WHERE l.ID = ? OR l.\`Employee ID\` = ?`;
    } else if (reqType.includes('disbursement')) {
        query = `SELECT d.*, u.phone_no, u.email FROM \`disbursements\` d LEFT JOIN users u ON LOWER(d.employee_id) = LOWER(u.user_id COLLATE utf8mb4_general_ci) WHERE d.id = ?`;
    } else if (reqType.includes('travel')) {
        query = `SELECT t.*, u.phone_no, u.email FROM \`travel\` t LEFT JOIN users u ON LOWER(t.employee_id) = LOWER(u.user_id COLLATE utf8mb4_general_ci) WHERE t.id = ?`;
    } else if (reqType.includes('overtime')) {
        query = `SELECT o.*, u.phone_no, u.email FROM \`overtime\` o LEFT JOIN users u ON LOWER(o.employee_id) = LOWER(u.user_id COLLATE utf8mb4_general_ci) WHERE o.id = ?`;
    } else if (reqType.includes('loan')) {
        query = `SELECT ln.*, u.phone_no, u.email FROM \`loans\` ln LEFT JOIN users u ON LOWER(ln.employee_id) = LOWER(u.user_id COLLATE utf8mb4_general_ci) WHERE ln.id = ?`;
    } else {
        return res.status(400).json({ success: false, message: 'Invalid or unsupported request type.' });
    }

    db.query(query, [id, id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ success: false, message: 'Record not found in database.' });
        }

        const record = { ...results[0] };
        
        // 2. Normalize attachment file path
        const rawDoc = record.supporting_document || record['Supporting Documen'] || record.attachment_path;
        record.supporting_document = normalizeFilePath(rawDoc);

        // 3. Fetch itemized expense rows for Disbursements
        if (reqType.includes('disbursement')) {
            const childQuery = `SELECT * FROM \`disbursement_items\` WHERE disbursement_id = ?`;
            db.query(childQuery, [record.id], (childErr, itemResults) => {
                record.items = itemResults || [];
                return res.json({ success: true, data: record });
            });
        } 
        // 4. Parse assigned employees for Travel requests
        else if (reqType.includes('travel')) {
            let employeeList = [];
            try {
                employeeList = typeof record.assigned_employees === 'string' 
                    ? JSON.parse(record.assigned_employees) 
                    : (record.assigned_employees || []);
            } catch (e) {
                employeeList = [];
            }

            record.employees = employeeList.length > 0 ? employeeList : [{
                employee_id: record.employee_id,
                name: record.employee_name,
                phone_no: record.phone_no || '—',
                email: record.email || '—',
                purpose_of_travel: 'Business trip'
            }];

            return res.json({ success: true, data: record });
        } 
        // 5. Standard return for Leave, Overtime, and Loans
        else {
            return res.json({ success: true, data: record });
        }
    });
});

// ==========================================================================
// API ROUTES: APPROVAL QUEUE (FETCH + UPDATE STATUS)
// ==========================================================================
router.get('/api/approval-queue', (req, res) => {
    const { user_id, department, position } = req.query;

    const userDept = (department || '').trim();
    const userPos = (position || '').trim().toLowerCase();
    const userId = (user_id || '').trim().toLowerCase();

    const isGlobalApprover = userPos.includes('ceo') || 
                             userDept.toLowerCase() === 'management' || 
                             userId.startsWith('ceo');

    let leaveQuery  = `SELECT ID as id, \`Employee ID\` as employee_id, \`Employee Name\` as employee_name, Department as department, 'Leave' as request_type, 'Not Applicable' as amount, \`Created At\` as date_submitted, last_reminder_sent, TRIM(Status) as status FROM \`leave\` WHERE 1=1`;
    let disQuery    = `SELECT id, employee_id, employee_name, department, 'Disbursement' as request_type, total_amount as amount, created_at as date_submitted, last_reminder_sent, TRIM(status) as status FROM \`disbursements\` WHERE 1=1`;
    let travelQuery = `SELECT id, employee_id, employee_name, department, 'Travel' as request_type, total_amount as amount, created_at as date_submitted, last_reminder_sent, TRIM(status) as status FROM \`travel\` WHERE 1=1`;
    let otQuery     = `SELECT id, employee_id, employee_name, department, 'Overtime' as request_type, total_claim as amount, created_at as date_submitted, last_reminder_sent, TRIM(status) as status FROM \`overtime\` WHERE 1=1`;
    let loanQuery   = `SELECT id, employee_id, employee_name, department, 'Loan' as request_type, amount_requested as amount, created_at as date_submitted, last_reminder_sent, TRIM(status) as status FROM \`loans\` WHERE 1=1`;

    const params = isGlobalApprover ? [] : [userDept];

    if (!isGlobalApprover && userDept) {
        leaveQuery  += ` AND LOWER(TRIM(Department)) = LOWER(TRIM(?))`;
        disQuery    += ` AND LOWER(TRIM(department)) = LOWER(TRIM(?))`;
        travelQuery += ` AND LOWER(TRIM(department)) = LOWER(TRIM(?))`;
        otQuery     += ` AND LOWER(TRIM(department)) = LOWER(TRIM(?))`;
        loanQuery   += ` AND LOWER(TRIM(department)) = LOWER(TRIM(?))`;
    }

    db.query(leaveQuery, params, (err1, leaveResults) => {
        db.query(disQuery, params, (err2, disResults) => {
            db.query(travelQuery, params, (err3, travelResults) => {
                db.query(otQuery, params, (err4, otResults) => {
                    db.query(loanQuery, params, (err5, loanResults) => {
                        const combinedQueue = [];

                        (leaveResults || []).forEach(row => combinedQueue.push({ ...row, table_source: 'leave' }));
                        (disResults || []).forEach(row => combinedQueue.push({ ...row, amount: `RM ${parseFloat(row.amount || 0).toFixed(2)}`, table_source: 'disbursements' }));
                        (travelResults || []).forEach(row => combinedQueue.push({ ...row, amount: `RM ${parseFloat(row.amount || 0).toFixed(2)}`, table_source: 'travel' }));
                        (otResults || []).forEach(row => combinedQueue.push({ ...row, amount: `RM ${parseFloat(row.amount || 0).toFixed(2)}`, table_source: 'overtime' }));
                        (loanResults || []).forEach(row => combinedQueue.push({ ...row, amount: `RM ${parseFloat(row.amount || 0).toFixed(2)}`, table_source: 'loans' }));

                        combinedQueue.sort((a, b) => new Date(b.date_submitted) - new Date(a.date_submitted));

                        return res.json({ success: true, data: combinedQueue });
                    });
                });
            });
        });
    });
});

// ==========================================================================
// 13. API ROUTE: UPDATE APPROVAL STATUS
// ==========================================================================
router.put('/api/approval-queue/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ success: false, message: 'Status parameter is required.' });
    }

    let tableName = '';
    let statusCol = 'status';

    const reqType = type.toLowerCase();
    if (reqType === 'leave') {
        tableName = 'leave';
        statusCol = 'Status';
    } else if (reqType === 'disbursement') {
        tableName = 'disbursements';
    } else if (reqType === 'travel') {
        tableName = 'travel';
    } else if (reqType === 'overtime') {
        tableName = 'overtime';
    } else if (reqType === 'loan' || reqType === 'loans') {
        tableName = 'loans';
    } else {
        return res.status(400).json({ success: false, message: 'Invalid request type.' });
    }

    const query = `UPDATE \`${tableName}\` SET \`${statusCol}\` = ? WHERE id = ? OR ID = ?`;
    
    db.query(query, [status, id, id], (err, result) => {
        if (err) {
            console.error('Update Status Error:', err);
            return res.status(500).json({ success: false, message: 'Failed to update request status.' });
        }
        return res.json({ success: true, message: `Request status updated to ${status}.` });
    });
});

// ==========================================================================
// DYNAMIC ROLE-BASED API ROUTE: FETCH MY REQUESTS
// ==========================================================================
router.get('/api/my-requests', (req, res) => {
    const req_user_id = req.query.employee_id;

    if (!req_user_id) {
        return res.status(400).json({ success: false, message: 'Employee ID parameter is required.' });
    }

    const roleQuery = 'SELECT position FROM users WHERE LOWER(user_id) = LOWER(?)';
    
    db.query(roleQuery, [req_user_id], (roleErr, roleResults) => {
        let isManagement = false;
        
        if (!roleErr && roleResults.length > 0) {
            const pos = roleResults[0].position.toLowerCase();
            if (pos === 'ceo' || pos === 'manager' || pos === 'supervisor' || pos === 'management') {
                isManagement = true;
            }
        }

        let leaveQuery  = `SELECT * FROM \`leave\``;
        let disQuery    = `SELECT * FROM \`disbursements\``;
        let travelQuery = `SELECT * FROM \`travel\``;
        let otQuery     = `SELECT * FROM \`overtime\``;
        let loanQuery   = `SELECT * FROM \`loans\``;
        let queryParams = [];

        if (!isManagement) {
            leaveQuery  = `SELECT * FROM \`leave\` WHERE LOWER(\`Employee ID\`) = LOWER(?)`;
            disQuery    = `SELECT * FROM \`disbursements\` WHERE LOWER(\`employee_id\`) = LOWER(?)`;
            travelQuery = `SELECT * FROM \`travel\` WHERE LOWER(\`employee_id\`) = LOWER(?)`;
            otQuery     = `SELECT * FROM \`overtime\` WHERE LOWER(\`employee_id\`) = LOWER(?)`;
            loanQuery   = `SELECT * FROM \`loans\` WHERE LOWER(\`employee_id\`) = LOWER(?)`;
            queryParams = [req_user_id];
        }

        db.query(leaveQuery, queryParams, (err, leaveResults) => {
            db.query(disQuery, queryParams, (err, disResults) => {
                db.query(travelQuery, queryParams, (err, travelResults) => {
                    db.query(otQuery, queryParams, (err, otResults) => {
                        db.query(loanQuery, queryParams, (err, loanResults) => {
                            const combinedData = [];

                            (leaveResults || []).forEach(row => {
                                const rawDate = row['Created At'] || row['Start Date'] || '—';
                                let formattedDate = '—';
                                try { formattedDate = new Date(rawDate).toISOString().split('T')[0]; } catch(e) {}

                                combinedData.push({
                                    id: row.id || row.ID || 0,
                                    employee_id: row['Employee ID'] || '—',
                                    employee_name: row['Employee Name'] || '—',
                                    request_type: 'Leave',
                                    details: row['Leave Type'] || 'Leave',
                                    start_date: row['Start Date'] || null,
                                    end_date: row['End Date'] || null,
                                    date_submitted: formattedDate,
                                    created_at: row['Created At'] || row['Start Date'] || null,
                                    last_reminder_sent: row.last_reminder_sent || null,
                                    amount: '—',
                                    status: (row['Status'] || 'Pending').trim()
                                });
                            });

                            (disResults || []).forEach(row => {
                                const rawDate = row['created_at'] || '—';
                                let formattedDate = '—';
                                try { formattedDate = new Date(rawDate).toISOString().split('T')[0]; } catch(e) {}

                                combinedData.push({
                                    id: row.id || 0,
                                    employee_id: row['employee_id'] || '—',
                                    employee_name: row['employee_name'] || '—',
                                    request_type: 'Disbursement',
                                    details: 'Expense Claim',
                                    date_submitted: formattedDate,
                                    created_at: row['created_at'] || null,
                                    last_reminder_sent: row.last_reminder_sent || null,
                                    amount: `RM ${parseFloat(row['total_amount'] || 0).toFixed(2)}`,
                                    status: (row['status'] || 'Pending').trim()
                                });
                            });

                            (travelResults || []).forEach(row => {
                                const rawDate = row['created_at'] || '—';
                                let formattedDate = '—';
                                try { formattedDate = new Date(rawDate).toISOString().split('T')[0]; } catch(e) {}

                                combinedData.push({
                                    id: row.id || 0,
                                    employee_id: row['employee_id'] || '—',
                                    employee_name: row['employee_name'] || '—',
                                    request_type: 'Travel',
                                    details: row['allowance_type'] || 'Travel Claim',
                                    date_submitted: formattedDate,
                                    created_at: row['created_at'] || null,
                                    last_reminder_sent: row.last_reminder_sent || null,
                                    amount: `RM ${parseFloat(row['total_amount'] || 0).toFixed(2)}`,
                                    status: (row['status'] || 'Pending').trim()
                                });
                            });

                            (otResults || []).forEach(row => {
                                const rawDate = row['created_at'] || '—';
                                let formattedDate = '—';
                                try { formattedDate = new Date(rawDate).toISOString().split('T')[0]; } catch(e) {}

                                combinedData.push({
                                    id: row.id || 0,
                                    employee_id: row['employee_id'] || '—',
                                    employee_name: row['employee_name'] || '—',
                                    request_type: 'Overtime',
                                    details: `OT Claim (${row['period'] || '0 hrs'})`,
                                    date_submitted: formattedDate,
                                    created_at: row['created_at'] || null,
                                    last_reminder_sent: row.last_reminder_sent || null,
                                    amount: `RM ${parseFloat(row['total_claim'] || 0).toFixed(2)}`,
                                    status: (row['status'] || 'Pending').trim()
                                });
                            });

                            (loanResults || []).forEach(row => {
                                const rawDate = row['created_at'] || '—';
                                let formattedDate = '—';
                                try { formattedDate = new Date(rawDate).toISOString().split('T')[0]; } catch(e) {}

                                combinedData.push({
                                    id: row.id || 0,
                                    employee_id: row['employee_id'] || '—',
                                    employee_name: row['employee_name'] || '—',
                                    request_type: 'Loan',
                                    details: `${row['loan_type']} Loan (${row['repayment_period']} mos)`,
                                    date_submitted: formattedDate,
                                    created_at: row['created_at'] || null,
                                    last_reminder_sent: row.last_reminder_sent || null,
                                    amount: `RM ${parseFloat(row['amount_requested'] || 0).toFixed(2)}`,
                                    status: (row['status'] || 'Pending').trim()
                                });
                            });

                            combinedData.sort((a, b) => {
                                if (a.date_submitted === '—') return 1;
                                if (b.date_submitted === '—') return -1;
                                return b.date_submitted.localeCompare(a.date_submitted);
                            });

                            return res.json({ success: true, data: combinedData });
                        });
                    });
                });
            });
        });
    });
});

// ==========================================================================
// API ROUTE: SEND REMINDER TO APPROVER (24-HOUR COOLDOWN ENFORCEMENT)
// ==========================================================================
router.post('/api/send-reminder', (req, res) => {
    const { id, type } = req.body;

    if (!id || !type) {
        return res.status(400).json({ success: false, message: 'Request ID and Type are required.' });
    }

    let tableName = '';
    const reqType = type.toLowerCase();

    if (reqType.includes('leave')) tableName = 'leave';
    else if (reqType.includes('disbursement')) tableName = 'disbursements';
    else if (reqType.includes('travel')) tableName = 'travel';
    else if (reqType.includes('overtime')) tableName = 'overtime';
    else if (reqType.includes('loan')) tableName = 'loans';
    else return res.status(400).json({ success: false, message: 'Invalid request type.' });

    const checkQuery = `SELECT id, created_at, last_reminder_sent, status FROM \`${tableName}\` WHERE id = ? OR ID = ?`;

    db.query(checkQuery, [id, id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ success: false, message: 'Request record not found.' });
        }

        const record = results[0];
        const status = (record.status || '').toLowerCase().trim();

        if (status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Reminders can only be sent for Pending requests.' });
        }

        const now = new Date();
        const lastCheck = record.last_reminder_sent ? new Date(record.last_reminder_sent) : new Date(record.created_at || now);
        const diffInHours = (now - lastCheck) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            const hoursLeft = Math.ceil(24 - diffInHours);
            return res.status(400).json({ 
                success: false, 
                message: `Reminder already sent recently. Please wait another ${hoursLeft} hour(s) before sending again.` 
            });
        }

        const updateQuery = `UPDATE \`${tableName}\` SET last_reminder_sent = NOW() WHERE id = ? OR ID = ?`;

        db.query(updateQuery, [id, id], (upErr) => {
            if (upErr) {
                console.error('Update Reminder Error:', upErr);
                return res.status(500).json({ success: false, message: 'Failed to send reminder.' });
            }

            return res.json({ 
                success: true, 
                message: 'Reminder notification successfully sent to the assigned approver!' 
            });
        });
    });
});

module.exports = router;
