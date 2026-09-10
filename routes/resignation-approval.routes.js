'use strict';
const express = require('express');
const mysql = require('mysql2/promise');

const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');
const approval = require('../utils/resignation-approval');
const probationService = require('../utils/probation-service');

const router = express.Router();
async function openConnection() {
    const { host, port, user, password, database, socketPath, ssl, timezone } = db.config;
    return mysql.createConnection({ host, port, user, password, database, socketPath, ssl, timezone });
}

function endpoint(action) {
    return async (req, res) => {
        let connection;
        res.set('Cache-Control', 'no-store');
        try {
            connection = await openConnection();
            const result = await action(connection, req);
            res.json(result);
        } catch (error) {
            const status = error.status || 500;
            if (status === 500) console.error('Resignation approval error:', error);
            res.status(status).json({
                success: false, message: status === 500
                    ? 'Unable to process approval. Check the server log.' : error.message
            });
        } finally {
            if (connection) await connection.end().catch(() => { });
        }
    };
}

// Mounted before the legacy approval router. Its PUT routes for other form types remain active.
router.put('/api/approval-queue/:type/:id', requireLogin, (req, res, next) => {
    if (approval.norm(req.params.type) !== 'resignation') return next();
    return endpoint((connection, request) => approval.decide(
        connection, request.session.user.user_id, request.params.id, request.body))(req, res);
});

router.get('/api/resignations/:id/approval-steps', requireLogin, endpoint(async (connection, req) => {
    const id = approval.requestId(req.params.id);
    const user = await approval.freshUser(connection, req.session.user.user_id);
    const [rows] = await connection.query(
        'SELECT id, requested_by, employee_id, department, status FROM resignations WHERE id = ?', [id]);
    if (!rows.length) throw approval.problem(404, 'Resignation request not found.');
    const record = rows[0];
    if (!approval.canRead(user, record)) throw approval.problem(403, 'Access denied for this resignation request.');
    const [steps] = await connection.query(`
        SELECT s.*, u.name AS acted_by_name
        FROM resignation_approval_steps s
        LEFT JOIN users u ON u.user_id = s.acted_by
        WHERE s.resignation_id = ? ORDER BY s.step_order`, [id]);
    const current = record.status === 'Pending' ? approval.validatePending(record, steps) : null;
    return {
        success: true, id, status: record.status,
        current_step: current ? { step_order: current.step_order, approver_role: current.approver_role } : null,
        can_approve: approval.canAct(user, record, current), data: steps
    };
}));

router.get('/api/approval-queue', requireLogin, endpoint(async (connection, req) => {
    const user = await approval.freshUser(connection, req.session.user.user_id);
    if (!approval.canOpenQueue(user)) throw approval.problem(403, 'Access denied: approver account required.');
    const legacy = approval.legacyAccess(user), combined = [];
    // Keep legacy form fields, amounts and department visibility unchanged.
    const sources = [
        ['leave', 'ID', 'Employee ID', 'Employee Name', 'Department', 'Leave', null, 'Created At', 'Status'],
        ['disbursements', 'id', 'employee_id', 'employee_name', 'department', 'Disbursement', 'total_amount', 'created_at', 'status'],
        ['travel', 'id', 'employee_id', 'employee_name', 'department', 'Travel', 'total_amount', 'created_at', 'status'],
        ['overtime', 'id', 'employee_id', 'employee_name', 'department', 'Overtime', 'total_claim', 'created_at', 'status'],
        ['loans', 'id', 'employee_id', 'employee_name', 'department', 'Loan', 'amount_requested', 'created_at', 'status']
    ];
    if (legacy.allowed) {
        for (const [table, id, employeeId, name, department, type, amount, date, status] of sources) {
            const [rows] = await connection.query(`
                SELECT \`${id}\` AS id, \`${employeeId}\` AS employee_id,
                    \`${name}\` AS employee_name, \`${department}\` AS department,
                    \`${date}\` AS date_submitted, last_reminder_sent,
                    TRIM(\`${status}\`) AS status, ${amount ? '`' + amount + '`' : 'NULL'} AS amount
                FROM \`${table}\`
                ${legacy.global ? '' : 'WHERE LOWER(TRIM(`' + department + '`)) = LOWER(TRIM(?))'}`,
                legacy.global ? [] : [user.department]);
            combined.push(...rows.map(row => ({
                ...row, request_type: type, table_source: table,
                amount: amount ? `RM ${parseFloat(row.amount || 0).toFixed(2)}` : 'Not Applicable'
            })));
        }
    }
    const [requests] = await connection.query(`
        SELECT r.id, r.requested_by, r.requested_by_name, r.employee_id, r.employee_name,
            r.department, r.created_at AS date_submitted, r.last_reminder_sent, r.status,
            s.step_order, s.approver_role, s.status AS step_status
        FROM resignations r
        JOIN resignation_approval_steps s ON s.resignation_id = r.id
        WHERE r.status = 'Pending' AND s.status = 'Pending'`);
    for (const row of requests) {
        if (!approval.canAct(user, row, { approver_role: row.approver_role, status: row.step_status })) continue;
        combined.push({
            ...row, request_type: 'Resignation', amount: 'Not Applicable',
            table_source: 'resignations', can_approve: true
        });
    }
    const probationQueue = await probationService.queue(
        connection,
        req.session.user.user_id
    );

    for (const row of probationQueue.data || []) {
        combined.push({
            ...row,
            date_submitted: row.created_at,
            amount: 'Not Applicable',
            last_reminder_sent: null,
            table_source: 'probation_confirmations',
            can_approve: true
        });
    }
    combined.sort((a, b) => (new Date(b.date_submitted).getTime() || 0) - (new Date(a.date_submitted).getTime() || 0));
    return { success: true, data: combined };
}));
module.exports = router;
