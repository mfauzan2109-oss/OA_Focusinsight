'use strict';
const { ROLES, norm, problem, requestId, freshUser, canAct, canRead, validatePending, canOpenQueue } = require('./resignation-approval');
const isHR = u => ['hr', 'human resources'].includes(norm(u.department)) || ['hr', 'human resources', 'hr specialist'].includes(norm(u.position));
const ratings = ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement'];
function validate(body) {
    if (!body || typeof body !== 'object') throw problem(400, 'Request body required.');
    const out = {};
    for (const [key, max] of [['employee_id', 20], ['probation_period', 50], ['probation_end_date', 10],
    ['overall_performance', 50], ['work_performance', 50], ['attendance_punctuality', 50],
    ['work_attitude_teamwork', 50], ['recommendation', 50]]) {
        if (typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > max) throw problem(400, 'Invalid ' + key + '.');
        out[key] = body[key].trim();
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(out.probation_end_date)) throw problem(400, 'Use YYYY-MM-DD for probation_end_date.');
    const d = new Date(out.probation_end_date + 'T00:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== out.probation_end_date || Number(out.probation_end_date.slice(0, 4)) < 1000) throw problem(400, 'Invalid probation end date.');
    for (const key of ['overall_performance', 'attendance_punctuality', 'work_attitude_teamwork']) if (!ratings.includes(out[key])) throw problem(400, 'Invalid ' + key + '.');
    if (!['Meet Expectations', 'Partially Meet Expectations', 'Does Not Meet Expectations'].includes(out.work_performance)) throw problem(400, 'Invalid work_performance.');
    if (!['Confirm Employment', 'Extend Probation', 'Do Not Confirm'].includes(out.recommendation)) throw problem(400, 'Invalid recommendation.');
    if (body.justification != null && (typeof body.justification !== 'string' || body.justification.length > 10000)) throw problem(400, 'Justification must be text up to 10000 characters.');
    out.justification = body.justification?.trim() || '';
    return out;
}
async function submit(c, sessionId, body, attachment) {
    const b = validate(body); let started = false;
    try {
        await c.beginTransaction(); started = true;
        const requester = await freshUser(c, sessionId, true);
        if (!isHR(requester)) throw problem(403, 'Only HR can initiate probation confirmation.');
        const [users] = await c.query('SELECT user_id, name, department, position, employment_type, join_date FROM users WHERE user_id = ? FOR SHARE', [b.employee_id]);
        if (users.length !== 1) throw problem(404, 'Employee not found.');
        const e = users[0];
        if (!norm(e.department)) throw problem(400, 'Employee department is required for HOD approval.');
        // Preserve the employee snapshot; never trust posted identity, salary, or status.
        const [insert] = await c.query(`INSERT INTO probation_confirmations
            (requested_by,request_date,department,employee_id,employee_name,employee_department,
            position,employment_type,employment_date,probation_period,probation_end_date,
            overall_performance,work_performance,attendance_punctuality,work_attitude_teamwork,
            recommendation,justification,supporting_document,status,created_at)
            VALUES (?,CURDATE(),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Pending',NOW())`,
            [requester.user_id, requester.department, e.user_id, e.name, e.department, e.position, e.employment_type, e.join_date,
            b.probation_period, b.probation_end_date, b.overall_performance, b.work_performance, b.attendance_punctuality,
            b.work_attitude_teamwork, b.recommendation, b.justification, attachment || null]);
        const rows = ROLES.map((role, i) => [insert.insertId, i + 1, role + ' Approval', role, i === 0 ? 'Pending' : 'Waiting']);
        await c.query('INSERT INTO probation_approval_steps (probation_id,step_order,step_label,approver_role,status) VALUES ?', [rows]);
        await c.commit(); started = false;
        return { success: true, id: insert.insertId, status: 'Pending', message: 'Probation confirmation submitted.', current_step: { step_order: 1, approver_role: ROLES[0] } };
    } catch (error) { if (started) await c.rollback().catch(() => { }); throw error; }
}
async function details(c, sessionId, idValue) {
    const id = requestId(idValue), user = await freshUser(c, sessionId);
    const [rows] = await c.query(`
    SELECT
        p.*,
        u.phone_no AS employee_phone_no,
        u.email AS employee_email
    FROM probation_confirmations p
    LEFT JOIN users u
        ON u.user_id = p.employee_id
    WHERE p.id = ?
`, [id]);
    if (!rows.length) throw problem(404, 'Probation confirmation not found.');
    const record = rows[0];

    const access = {
        ...record,
        department: record.employee_department
    };

    const data = {
        ...record,
        requester_department: record.department,
        department: record.employee_department,
        phone_no: record.employee_phone_no || null,
        email: record.employee_email || null
    };
    if (!canRead(user, access)) throw problem(403, 'Access denied for this probation request.');
    const [steps] = await c.query(`SELECT s.*,u.name AS acted_by_name FROM probation_approval_steps s
        LEFT JOIN users u ON u.user_id=s.acted_by WHERE s.probation_id=? ORDER BY s.step_order`, [id]);
    const current = record.status === 'Pending' ? validatePending(access, steps) : null;
    return {
        success: true,
        id,
        status: record.status,
        data: data,
        steps,
        current_step: current
            ? {
                step_order: Number(current.step_order),
                approver_role: current.approver_role
            }
            : null,
        can_approve: canAct(user, access, current)
    };
}
async function queue(c, sessionId) {
    const user = await freshUser(c, sessionId);
    if (!canOpenQueue(user)) throw problem(403, 'Approver account required.');
    const [rows] = await c.query(`SELECT p.id,p.requested_by,p.employee_id,p.employee_name,
        p.employee_department AS department,p.status,p.recommendation,p.created_at,
        'Probation Confirmation' AS request_type,s.step_order,s.approver_role,s.status AS step_status
        FROM probation_confirmations p JOIN probation_approval_steps s ON s.probation_id=p.id
        WHERE p.status='Pending' AND s.status='Pending' ORDER BY p.created_at DESC,p.id DESC`);
    return { success: true, data: rows.filter(r => canAct(user, r, { status: r.step_status, approver_role: r.approver_role })).map(r => ({ ...r, can_approve: true })) };
}
async function mine(c, sessionId) {
    const user = await freshUser(c, sessionId);
    const [rows] = await c.query(`SELECT id,employee_id,employee_name,employee_department,request_date,recommendation,status,created_at,
        'Probation Confirmation' AS request_type FROM probation_confirmations WHERE requested_by=? ORDER BY created_at DESC,id DESC`, [user.user_id]);
    return { success: true, data: rows };
}
async function notifications(c, sessionId) {
    const user = await freshUser(c, sessionId);
    const [rows] = await c.query(`SELECT id AS notification_id,probation_id AS id,outcome AS status,created_at AS time,
        'Probation Confirmation' AS type FROM probation_notifications WHERE recipient_id=? ORDER BY id DESC`, [user.user_id]);
    return { success: true, notifications: rows };
}
async function decide(connection, sessionUserId, idValue, body) {
    const id = requestId(idValue);
    if (!body || !['Approved', 'Rejected'].includes(body.status)) {
        throw problem(400, 'Status must be Approved or Rejected.');
    }

    const suppliedStep =
        body.step_order == null
            ? null
            : Number(body.step_order);

    if (
        suppliedStep !== null &&
        (
            !Number.isInteger(suppliedStep) ||
            suppliedStep < 1 ||
            suppliedStep > 5
        )
    ) {
        throw problem(400, 'Invalid step_order.');
    }

    const remarks =
        body.remarks ??
        body.comment ??
        null;

    if (
        remarks != null &&
        (
            typeof remarks !== 'string' ||
            remarks.length > 2000
        )
    ) {
        throw problem(
            400,
            'Remarks must be text with at most 2000 characters.'
        );
    }
    let started = false;
    try {
        await connection.beginTransaction(); started = true;
        const user = await freshUser(connection, sessionUserId, true);
        const [requests] = await connection.query(
            'SELECT id, employee_department AS department, requested_by, employee_id, status FROM probation_confirmations WHERE id = ? FOR UPDATE', [id]);
        if (!requests.length) throw problem(404, 'Probation request not found.');
        const record = requests[0];
        if (!canRead(user, record)) throw problem(403, 'Access denied for this probation request.');
        const [steps] = await connection.query(
            'SELECT * FROM probation_approval_steps WHERE probation_id = ? ORDER BY step_order FOR UPDATE', [id]);
        const current = validatePending(record, steps);
        if (
            suppliedStep !== null &&
            Number(current.step_order) !== suppliedStep
        ) {
            throw problem(
                409,
                'Approval step has changed. Reload the request before submitting.'
            );
        }
        if (!canAct(user, record, current)) throw problem(403, 'You are not the approver for the current step.');
        const [changed] = await connection.query(
            "UPDATE probation_approval_steps SET status = ?, acted_by = ?, acted_at = NOW(), remarks = ? WHERE id = ? AND status = 'Pending'",
            [body.status, user.user_id, remarks?.trim() || null, current.id]);
        if (changed.affectedRows !== 1) throw problem(409, 'Approval step has already changed.');
        let overall = 'Pending', next = null;
        if (body.status === 'Rejected') {
            overall = 'Rejected';
            await connection.query(
                "UPDATE probation_approval_steps SET status = 'Cancelled' WHERE probation_id = ? AND status = 'Waiting'", [id]);
        } else {
            next = steps.find(s => Number(s.step_order) === Number(current.step_order) + 1) || null;
            if (next) {
                const [activated] = await connection.query(
                    "UPDATE probation_approval_steps SET status = 'Pending' WHERE id = ? AND status = 'Waiting'", [next.id]);
                if (activated.affectedRows !== 1) throw problem(409, 'Next approval step could not be activated.');
            } else overall = 'Approved';
        }
        if (overall !== 'Pending') {
            const [updated] = await connection.query(
                "UPDATE probation_confirmations SET status = ? WHERE id = ? AND status = 'Pending'", [overall, id]);
            if (updated.affectedRows !== 1) throw problem(409, 'Request has already changed.');
        }
        if (overall !== 'Pending') {
            const [requesters] = await connection.query('SELECT user_id FROM users WHERE user_id = ? FOR SHARE', [record.requested_by]);
            if (requesters.length !== 1) throw problem(409, 'Requesting HR account is missing.');
            await connection.query(`INSERT INTO probation_notifications (probation_id,recipient_id,outcome)
                VALUES (?,?,?) ON DUPLICATE KEY UPDATE id=id`, [id, requesters[0].user_id, overall]);
        }
        await connection.commit(); started = false;
        return {
            success: true, id, status: overall,
            completed_step: Number(current.step_order), decision: body.status,
            next_step: next ? { step_order: Number(next.step_order), approver_role: next.approver_role } : null
        };
    } catch (error) {
        if (started) await connection.rollback().catch(() => { });
        throw error;
    }
}

module.exports = { validate, submit, details, queue, mine, notifications, decide };
