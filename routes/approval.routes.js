const express = require('express');
const mysql = require('mysql2/promise');

const db = require('../config/database');
const { sendEmail } = require('../utils/email-service');
const { resolveApproverRecipients } = require('../utils/p1-email');

const router = express.Router();

// History page shows forms this user APPROVED. Set to true to also list forms they rejected.
const INCLUDE_REJECTED_IN_HISTORY = false;

// ---------------------------------------------------------------------------
// Request types: main table, approval-steps table and the columns used by each
// ---------------------------------------------------------------------------
const REQUEST_TYPES = {
    leave: {
        table: 'leave', idCol: 'ID', statusCol: 'Status', deptCol: 'Department',
        stepsTable: 'leave_approval_steps', fk: 'leave_id',
        cols: "m.ID AS id, m.`Employee ID` AS employee_id, m.`Employee Name` AS employee_name, m.Department AS department, 'Leave' AS request_type, 'Not Applicable' AS amount, m.`Created At` AS date_submitted, m.last_reminder_sent AS last_reminder_sent, TRIM(m.Status) AS status"
    },
    disbursement: {
        table: 'disbursements', idCol: 'id', statusCol: 'status', deptCol: 'department',
        stepsTable: 'disbursement_approval_steps', fk: 'disbursement_id',
        cols: "m.id AS id, m.employee_id AS employee_id, m.employee_name AS employee_name, m.department AS department, 'Disbursement' AS request_type, m.total_amount AS amount, m.created_at AS date_submitted, m.last_reminder_sent AS last_reminder_sent, TRIM(m.status) AS status"
    },
    travel: {
        table: 'travel', idCol: 'id', statusCol: 'status', deptCol: 'department',
        stepsTable: 'travel_approval_steps', fk: 'travel_id',
        cols: "m.id AS id, m.employee_id AS employee_id, m.employee_name AS employee_name, m.department AS department, 'Travel' AS request_type, m.total_amount AS amount, m.created_at AS date_submitted, m.last_reminder_sent AS last_reminder_sent, TRIM(m.status) AS status"
    },
    overtime: {
        table: 'overtime', idCol: 'id', statusCol: 'status', deptCol: 'department',
        stepsTable: 'overtime_approval_steps', fk: 'overtime_id',
        cols: "m.id AS id, m.employee_id AS employee_id, m.employee_name AS employee_name, m.department AS department, 'Overtime' AS request_type, m.total_claim AS amount, m.created_at AS date_submitted, m.last_reminder_sent AS last_reminder_sent, TRIM(m.status) AS status"
    },
    loan: {
        table: 'loans', idCol: 'id', statusCol: 'status', deptCol: 'department',
        stepsTable: 'loan_approval_steps', fk: 'loan_id',
        cols: "m.id AS id, m.employee_id AS employee_id, m.employee_name AS employee_name, m.department AS department, 'Loan' AS request_type, m.amount_requested AS amount, m.created_at AS date_submitted, m.last_reminder_sent AS last_reminder_sent, TRIM(m.status) AS status"
    }
};

function resolveTypeKey(raw) {
    const t = String(raw || '').trim().toLowerCase();
    if (t === 'loans') return 'loan';
    if (t === 'disbursements') return 'disbursement';
    return REQUEST_TYPES[t] ? t : null;
}

function q(sql, params) {
    return new Promise((resolve, reject) => {
        db.query(sql, params || [], (err, rows) => (err ? reject(err) : resolve(rows)));
    });
}

function formatAmount(typeKey, amount) {
    return typeKey === 'leave' ? amount : `RM ${parseFloat(amount || 0).toFixed(2)}`;
}

function currentUserId(req) {
    return String((req.session && req.session.user && req.session.user.user_id) || req.query.user_id || '').trim();
}

// Requests (type:id) this user has already acted on -> hidden from their queue.
async function getActedKeys(actor) {
    const keys = new Set();
    if (!actor) return keys;
    for (const [typeKey, cfg] of Object.entries(REQUEST_TYPES)) {
        try {
            const rows = await q(
                `SELECT DISTINCT ${cfg.fk} AS rid FROM ${cfg.stepsTable} WHERE LOWER(acted_by) = LOWER(?)`,
                [actor]
            );
            rows.forEach(r => keys.add(`${typeKey}:${r.rid}`));
        } catch (e) {
            // acted_by column missing -> nothing to hide
        }
    }
    return keys;
}

// ---------------------------------------------------------------------------
// GET queue
// ---------------------------------------------------------------------------
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
                    db.query(loanQuery, params, async (err5, loanResults) => {
                        let combinedQueue = [];

                        (leaveResults || []).forEach(row => combinedQueue.push({ ...row, table_source: 'leave' }));
                        (disResults || []).forEach(row => combinedQueue.push({ ...row, amount: `RM ${parseFloat(row.amount || 0).toFixed(2)}`, table_source: 'disbursements' }));
                        (travelResults || []).forEach(row => combinedQueue.push({ ...row, amount: `RM ${parseFloat(row.amount || 0).toFixed(2)}`, table_source: 'travel' }));
                        (otResults || []).forEach(row => combinedQueue.push({ ...row, amount: `RM ${parseFloat(row.amount || 0).toFixed(2)}`, table_source: 'overtime' }));
                        (loanResults || []).forEach(row => combinedQueue.push({ ...row, amount: `RM ${parseFloat(row.amount || 0).toFixed(2)}`, table_source: 'loans' }));

                        // Hide requests this user has already approved (they live in Approval History).
                        const acted = await getActedKeys(currentUserId(req));
                        if (acted.size) {
                            combinedQueue = combinedQueue.filter(
                                row => !acted.has(`${String(row.request_type).toLowerCase()}:${row.id}`)
                            );
                        }

                        combinedQueue.sort((a, b) => new Date(b.date_submitted) - new Date(a.date_submitted));

                        return res.json({ success: true, data: combinedQueue });
                    });
                });
            });
        });
    });
});

// ---------------------------------------------------------------------------
// GET history: requests THIS user approved
// ---------------------------------------------------------------------------
router.get('/api/approval-history', async (req, res) => {
    const actor = currentUserId(req);
    if (!actor) {
        return res.status(401).json({ success: false, message: 'Not logged in.' });
    }

    const actions = INCLUDE_REJECTED_IN_HISTORY ? "('approved', 'rejected')" : "('approved')";
    const rows = [];
    let failed = 0;

    for (const [typeKey, cfg] of Object.entries(REQUEST_TYPES)) {
        try {
            const result = await q(
                `SELECT ${cfg.cols}, s.acted_at AS acted_at, s.step_label AS step_label, s.status AS my_action
                 FROM \`${cfg.table}\` m
                 JOIN ${cfg.stepsTable} s ON s.${cfg.fk} = m.\`${cfg.idCol}\`
                 WHERE LOWER(s.acted_by) = LOWER(?)
                   AND LOWER(TRIM(s.status)) IN ${actions}`,
                [actor]
            );
            result.forEach(r => rows.push({ ...r, amount: formatAmount(typeKey, r.amount) }));
        } catch (err) {
            failed++;
            console.error(`Approval History (${typeKey}) Error:`, err.message);
        }
    }

    if (failed === Object.keys(REQUEST_TYPES).length) {
        return res.status(500).json({ success: false, message: 'Database error.' });
    }

    rows.sort((a, b) => new Date(b.acted_at || 0) - new Date(a.acted_at || 0));
    return res.json({ success: true, data: rows });
});

// ---------------------------------------------------------------------------
// PUT approve / reject: advances ONE step. Request is only "Approved" after the last step.
// ---------------------------------------------------------------------------
async function notifyNextApprover(connection, typeKey, id, nextStep, department) {
    try {
        const recipients = await resolveApproverRecipients(connection, nextStep.approver_role, department);
        const ref = `REQ-${typeKey.toUpperCase()}-${id}`;
        for (const r of recipients) {
            await sendEmail({
                to: r.email,
                subject: `Approval Required: ${ref}`,
                text:
                    `Hi ${r.name || r.user_id},\n\n` +
                    `A ${typeKey.toUpperCase()} request requires your approval.\n` +
                    `Request: ${ref}\nRole: ${nextStep.approver_role}\n\n` +
                    `Please log in to the FocusInsight OA System to review the request.`
            });
        }
    } catch (e) {
        console.error('[EMAIL] Next approver notification failed:', e.message);
    }
}

router.put('/api/approval-queue/:type/:id', async (req, res) => {
    const typeKey = resolveTypeKey(req.params.type);
    const id = req.params.id;
    const { status, comment } = req.body || {};

    if (!status) {
        return res.status(400).json({ success: false, message: 'Status parameter is required.' });
    }
    if (!typeKey) {
        return res.status(400).json({ success: false, message: 'Invalid request type.' });
    }

    const cfg = REQUEST_TYPES[typeKey];
    const action = String(status).trim().toLowerCase();
    const actor = String((req.session && req.session.user && req.session.user.user_id) || '').trim();

    if (!actor) {
        return res.status(401).json({ success: false, message: 'Please log in again.' });
    }

    const { host, port, user, password, database, socketPath, ssl, timezone } = db.config;
    let connection;

    try {
        connection = await mysql.createConnection({ host, port, user, password, database, socketPath, ssl, timezone });

        const [steps] = await connection.query(
            `SELECT * FROM ${cfg.stepsTable} WHERE ${cfg.fk} = ? ORDER BY step_order`,
            [id]
        );

        // Old requests without steps (or other statuses like "Revision"): previous behaviour.
        if (!steps.length || (action !== 'approved' && action !== 'rejected')) {
            await connection.query(
                `UPDATE \`${cfg.table}\` SET \`${cfg.statusCol}\` = ? WHERE \`${cfg.idCol}\` = ?`,
                [status, id]
            );
            return res.json({ success: true, message: `Request status updated to ${status}.` });
        }

        const current = steps.find(s => String(s.status || '').trim().toLowerCase() === 'pending');
        if (!current) {
            return res.status(409).json({ success: false, message: 'This request has no step waiting for approval.' });
        }

        const [[reqRow]] = await connection.query(
            `SELECT \`${cfg.deptCol}\` AS department FROM \`${cfg.table}\` WHERE \`${cfg.idCol}\` = ?`,
            [id]
        );
        if (!reqRow) {
            return res.status(404).json({ success: false, message: 'Request not found.' });
        }

        // Only the person holding the current step's role may act on it.
        const recipients = await resolveApproverRecipients(connection, current.approver_role, reqRow.department);
        const allowed = (recipients || []).some(
            r => String(r.user_id || '').toLowerCase() === actor.toLowerCase()
        );
        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: `This request is waiting for ${current.approver_role} approval. You are not the approver for this step.`
            });
        }

        const stepStatus = action === 'approved' ? 'Approved' : 'Rejected';
        const next = action === 'approved'
            ? steps.find(s => s.step_order > current.step_order)
            : null;

        await connection.beginTransaction();

        await connection.query(
            `UPDATE ${cfg.stepsTable}
             SET status = ?, acted_by = ?, acted_at = NOW(), remarks = ?
             WHERE ${cfg.fk} = ? AND step_order = ?`,
            [stepStatus, actor, comment || null, id, current.step_order]
        );

        let message;
        if (action === 'rejected') {
            await connection.query(
                `UPDATE \`${cfg.table}\` SET \`${cfg.statusCol}\` = 'Rejected' WHERE \`${cfg.idCol}\` = ?`,
                [id]
            );
            message = 'Request rejected.';
        } else if (next) {
            await connection.query(
                `UPDATE ${cfg.stepsTable} SET status = 'Pending' WHERE ${cfg.fk} = ? AND step_order = ?`,
                [id, next.step_order]
            );
            message = `Your approval is recorded. The request now goes to ${next.approver_role}.`;
        } else {
            await connection.query(
                `UPDATE \`${cfg.table}\` SET \`${cfg.statusCol}\` = 'Approved' WHERE \`${cfg.idCol}\` = ?`,
                [id]
            );
            message = 'Request fully approved.';
        }

        await connection.commit();

        if (next) {
            await notifyNextApprover(connection, typeKey, id, next, reqRow.department);
        }

        return res.json({ success: true, message });
    } catch (err) {
        if (connection) await connection.rollback().catch(() => { });
        console.error('Update Status Error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update request status.' });
    } finally {
        if (connection) await connection.end().catch(() => { });
    }
});

module.exports = router;