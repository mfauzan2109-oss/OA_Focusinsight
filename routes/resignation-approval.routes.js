'use strict';
const express = require('express');
const mysql = require('mysql2/promise');

const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');
const approval = require('../utils/resignation-approval');
const probationService = require('../utils/probation-service');
const salaryAdjustmentApproval = require('../utils/salary-adjustment-approval');
const p1Approval = require('../utils/p1-approval');

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
    const type = approval.norm(req.params.type);

    if (type === 'resignation') {
        return endpoint((connection, request) =>
            approval.decide(
                connection,
                request.session.user.user_id,
                request.params.id,
                request.body
            )
        )(req, res);
    }

    if (
        type === 'salary adjustment' ||
        type === 'salary-adjustment' ||
        type === 'salary_adjustment'
    ) {
        return endpoint((connection, request) =>
            salaryAdjustmentApproval.decide(
                connection,
                request.session.user.user_id,
                request.params.id,
                request.body
            )
        )(req, res);
    }

    if (
        type === 'leave' ||
        type === 'travel' ||
        type === 'disbursement' ||
        type === 'loan' ||
        type === 'overtime'
    ) {
        return endpoint((connection, request) =>
            p1Approval.decide(
                connection,
                type,
                request.session.user.user_id,
                request.params.id,
                request.body.status,
                request.body.remarks || request.body.comment || null
            )
        )(req, res);
    }

    return next();
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
    const sources = [];

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
    const [leaveRequests] = await connection.query(`
    SELECT
        l.ID AS id,
        l.\`Employee ID\` AS employee_id,
        l.\`Employee Name\` AS employee_name,
        l.Department AS department,
        l.\`Created At\` AS date_submitted,
        l.last_reminder_sent,
        l.Status AS status,
        s.step_order,
        s.approver_role,
        s.status AS step_status
    FROM \`leave\` l
    JOIN leave_approval_steps s
        ON s.leave_id = l.ID
    WHERE l.Status = 'Pending'
      AND s.status = 'Pending'
`);

    for (const row of leaveRequests) {
        if (!p1Approval.canAct(
            user,
            row,
            {
                approver_role: row.approver_role,
                status: row.step_status
            }
        )) continue;

        combined.push({
            ...row,
            request_type: 'Leave',
            amount: 'Not Applicable',
            table_source: 'leave',
            can_approve: true
        });
    }

    const [travelRequests] = await connection.query(`
    SELECT
        t.id,
        t.employee_id,
        t.employee_name,
        t.department,
        t.created_at AS date_submitted,
        t.last_reminder_sent,
        t.status,
        t.total_amount,
        s.step_order,
        s.approver_role,
        s.status AS step_status
    FROM travel t
    JOIN travel_approval_steps s
        ON s.travel_id = t.id
    WHERE t.status = 'Pending'
      AND s.status = 'Pending'
`);

    for (const row of travelRequests) {
        if (!p1Approval.canAct(
            user,
            row,
            {
                approver_role: row.approver_role,
                status: row.step_status
            }
        )) continue;

        combined.push({
            ...row,
            request_type: 'Travel',
            amount: `RM ${parseFloat(row.total_amount || 0).toFixed(2)}`,
            table_source: 'travel',
            can_approve: true
        });
    }

    const [disbursementRequests] = await connection.query(`
    SELECT
        d.id,
        d.employee_id,
        d.employee_name,
        d.department,
        d.created_at AS date_submitted,
        d.last_reminder_sent,
        d.status,
        d.total_amount,
        s.step_order,
        s.approver_role,
        s.status AS step_status
    FROM disbursements d
    JOIN disbursement_approval_steps s
        ON s.disbursement_id = d.id
    WHERE d.status = 'Pending'
      AND s.status = 'Pending'
`);

    for (const row of disbursementRequests) {
        if (!p1Approval.canAct(
            user,
            row,
            {
                approver_role: row.approver_role,
                status: row.step_status
            }
        )) continue;

        combined.push({
            ...row,
            request_type: 'Disbursement',
            amount: `RM ${parseFloat(
                row.total_amount || 0
            ).toFixed(2)}`,
            table_source: 'disbursements',
            can_approve: true
        });
    }

    const [overtimeRequests] = await connection.query(`
    SELECT
        o.id,
        o.employee_id,
        o.employee_name,
        o.department,
        o.created_at AS date_submitted,
        o.last_reminder_sent,
        o.status,
        o.total_claim,
        s.step_order,
        s.approver_role,
        s.status AS step_status
    FROM overtime o
    JOIN overtime_approval_steps s
        ON s.overtime_id = o.id
    WHERE o.status = 'Pending'
      AND s.status = 'Pending'
`);

    for (const row of overtimeRequests) {
        if (!p1Approval.canAct(
            user,
            row,
            {
                approver_role: row.approver_role,
                status: row.step_status
            }
        )) continue;

        combined.push({
            ...row,
            request_type: 'Overtime',
            amount: `RM ${parseFloat(
                row.total_claim || 0
            ).toFixed(2)}`,
            table_source: 'overtime',
            can_approve: true
        });
    }

    const [loanRequests] = await connection.query(`
    SELECT
        l.id,
        l.employee_id,
        l.employee_name,
        l.department,
        l.created_at AS date_submitted,
        l.last_reminder_sent,
        l.status,
        l.amount_requested,
        s.step_order,
        s.approver_role,
        s.status AS step_status
    FROM loans l
    JOIN loan_approval_steps s
        ON s.loan_id = l.id
    WHERE l.status = 'Pending'
      AND s.status = 'Pending'
`);

    for (const row of loanRequests) {
        if (!p1Approval.canAct(
            user,
            row,
            {
                approver_role: row.approver_role,
                status: row.step_status
            }
        )) continue;

        combined.push({
            ...row,
            request_type: 'Loan',
            amount: `RM ${parseFloat(
                row.amount_requested || 0
            ).toFixed(2)}`,
            table_source: 'loans',
            can_approve: true
        });
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

    const [salaryAdjustmentRequests] =
        await connection.query(`
        SELECT
            sa.id,
            sa.requested_by,
            sa.requested_by_name,
            sa.employee_id,
            sa.employee_name,
            sa.department,
            sa.adjustment_type,
            sa.adjustment_amount,
            sa.created_at AS date_submitted,
            sa.status,
            s.step_order,
            s.approver_role,
            s.status AS step_status
        FROM salary_adjustments sa
        JOIN salary_adjustment_approval_steps s
            ON s.salary_adjustment_id = sa.id
        WHERE sa.status = 'Pending'
          AND s.status = 'Pending'
    `);

    for (const row of salaryAdjustmentRequests) {
        if (
            !salaryAdjustmentApproval.canAct(
                user,
                row,
                {
                    approver_role: row.approver_role,
                    status: row.step_status
                }
            )
        ) {
            continue;
        }

        combined.push({
            ...row,
            request_type: 'Salary Adjustment',
            amount:
                row.adjustment_amount != null
                    ? `RM ${parseFloat(row.adjustment_amount).toFixed(2)}`
                    : 'Not Applicable',
            table_source: 'salary_adjustments',
            can_approve: true
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
