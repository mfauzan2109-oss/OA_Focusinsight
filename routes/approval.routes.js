const express = require('express');

const db = require('../config/database');

const router = express.Router();

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

module.exports = router;
