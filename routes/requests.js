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

    let leaveQuery  = `SELECT ID as id, \`Employee ID\` as employee_id, \`Employee Name\` as employee_name, Department as department, 'Leave' as request_type, 'Not Applicable' as amount, \`Created At\` as date_submitted, last_reminder_sent, resubmission_count, TRIM(Status) as status FROM \`leave\` WHERE 1=1`;
    let disQuery    = `SELECT id, employee_id, employee_name, department, 'Disbursement' as request_type, total_amount as amount, created_at as date_submitted, last_reminder_sent, resubmission_count, TRIM(status) as status FROM \`disbursements\` WHERE 1=1`;
    let travelQuery = `SELECT id, employee_id, employee_name, department, 'Travel' as request_type, total_amount as amount, created_at as date_submitted, last_reminder_sent, resubmission_count, TRIM(status) as status FROM \`travel\` WHERE 1=1`;
    let otQuery     = `SELECT id, employee_id, employee_name, department, 'Overtime' as request_type, total_claim as amount, created_at as date_submitted, last_reminder_sent, resubmission_count, TRIM(status) as status FROM \`overtime\` WHERE 1=1`;
    let loanQuery   = `SELECT id, employee_id, employee_name, department, 'Loan' as request_type, amount_requested as amount, created_at as date_submitted, last_reminder_sent, resubmission_count, TRIM(status) as status FROM \`loans\` WHERE 1=1`;

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
    const { status, comment, approver_name } = req.body;

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

    const isRejection = status.toLowerCase().includes('reject');

    let query;
    let params;

    if (isRejection) {
        query = `UPDATE \`${tableName}\` SET \`${statusCol}\` = ?, rejection_reason = ?, rejected_by = ?, rejected_at = NOW() WHERE id = ? OR ID = ?`;
        params = [status, comment || null, approver_name || 'Approving Manager', id, id];
    } else {
        query = `UPDATE \`${tableName}\` SET \`${statusCol}\` = ? WHERE id = ? OR ID = ?`;
        params = [status, id, id];
    }

    db.query(query, params, (err, result) => {
        if (err) {
            console.error('Update Status Error:', err);
            return res.status(500).json({ success: false, message: 'Failed to update request status.' });
        }
        return res.json({ success: true, message: `Request status updated to ${status}.` });
    });
});

// ==========================================================================
// API ROUTE: RESUBMIT A REJECTED REQUEST (Edit -> Resubmit flow)
// ==========================================================================
router.post('/api/resubmit-request', (req, res) => {
    const { id, type, employee_id, reason, ...fields } = req.body;

    if (!id || !type) {
        return res.status(400).json({ success: false, message: 'Request ID and Type are required.' });
    }

    const reqType = type.toLowerCase();

    // Maps the data-field names sent by request-details.html to each
    // table's actual column names, since leave uses capitalized/spaced
    // column names while the other tables use lowercase snake_case.
    let tableName = '';
    let idCol = 'id';
    let statusCol = 'status';
    let reasonCol = ''; // only set per-branch below when the table is confirmed to have a reason-equivalent column
    let columnMap = {};
    let resubCap = 3;

    if (reqType.includes('leave')) {
        tableName = 'leave';
        idCol = 'ID';
        statusCol = 'Status';
        reasonCol = 'Reason';
        columnMap = {
            leave_type: '`Leave Type`',
            day_type: '`Day type`',
            start_date: '`Start Date`',
            end_date: '`End Date`',
            total_days: '`No of Days`'
        };
    } else if (reqType.includes('overtime')) {
        tableName = 'overtime';
        reasonCol = 'reason'; // `overtime` table has a `reason` column
        columnMap = {
            ot_date: 'ot_date',
            day_type: 'day_type',
            start_time: 'start_time',
            end_time: 'end_time',
            night_allowance: 'night_allowance',
            meal_allowance: 'meal_allowance'
        };
    } else if (reqType.includes('travel')) {
        tableName = 'travel';
        columnMap = {
            allowance_type: 'allowance_type',
            claim_month: 'claim_month'
        };
    } else if (reqType.includes('loan')) {
        tableName = 'loans';
        columnMap = {
            loan_type: 'loan_type',
            repayment_period: 'repayment_period',
            monthly_salary: 'monthly_salary',
            disbursement_method: 'disbursement_method',
            account_holder: 'account_holder',
            account_number: 'account_number'
        };
    } else if (reqType.includes('disbursement')) {
        tableName = 'disbursements';
        columnMap = {}; // total_amount / itemized rows aren't edited through this generic flow
    } else {
        return res.status(400).json({ success: false, message: 'Invalid or unsupported request type.' });
    }

    // First, check the current resubmission_count so we can enforce the cap server-side too
    const checkQuery = `SELECT resubmission_count, \`${statusCol}\` AS current_status FROM \`${tableName}\` WHERE \`${idCol}\` = ?`;

    db.query(checkQuery, [id], (checkErr, checkResults) => {
        if (checkErr || checkResults.length === 0) {
            console.error('Resubmit lookup error:', checkErr);
            return res.status(404).json({ success: false, message: 'Request record not found.' });
        }

        const currentCount = parseInt(checkResults[0].resubmission_count || 0, 10);

        if (currentCount >= resubCap) {
            return res.status(400).json({ success: false, message: `Maximum resubmissions (${resubCap}) already reached for this request.` });
        }

        // Build the SET clause from whichever known fields were sent
        const setClauses = [`\`${statusCol}\` = 'Pending'`, `resubmission_count = resubmission_count + 1`];
        const params = [];

        Object.keys(columnMap).forEach((fieldKey) => {
            if (Object.prototype.hasOwnProperty.call(fields, fieldKey)) {
                let value = fields[fieldKey];
                // Safety net: MySQL DATE columns reject full ISO timestamps
                // (e.g. "2026-09-09T16:00:00.000Z") sent from the frontend —
                // strip everything from "T" onward so only "YYYY-MM-DD" is stored.
                if (typeof value === 'string' && /date/i.test(fieldKey) && value.includes('T')) {
                    value = value.split('T')[0];
                }
                setClauses.push(`${columnMap[fieldKey]} = ?`);
                params.push(value);
            }
        });

        if (reason !== undefined && reasonCol) {
            setClauses.push(`\`${reasonCol}\` = ?`);
            params.push(reason);
        }

        const updateQuery = `UPDATE \`${tableName}\` SET ${setClauses.join(', ')} WHERE \`${idCol}\` = ?`;
        params.push(id);

        db.query(updateQuery, params, (updateErr) => {
            if (updateErr) {
                console.error('Resubmit update error:', updateErr);
                return res.status(500).json({ success: false, message: 'Failed to resubmit request.' });
            }

            return res.json({
                success: true,
                message: 'Request resubmitted successfully.',
                resubmission_count: currentCount + 1
            });
        });
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