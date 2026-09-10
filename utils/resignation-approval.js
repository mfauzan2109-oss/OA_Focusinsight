'use strict';

const { enqueueOutcome } = require('./resignation-notifications');

const ROLES = ['Head of Department', 'VGM', 'CEO', 'Chairman', 'HR Specialist'];
const norm = value => String(value || '').trim().toLowerCase();
function problem(status, message) { return Object.assign(new Error(message), { status }); }
function requestId(value) {
    const raw = String(value);
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
        throw problem(400, 'Invalid request ID.');
    }
    return Number(raw);
}
function isHR(user) {
    return ['hr', 'human resources'].includes(norm(user.department)) ||
        ['hr', 'human resources', 'hr specialist'].includes(norm(user.position));
}
function isHOD(user) {
    return ['manager', 'head of department', 'hod'].includes(norm(user.position));
}
function legacyAccess(user) {
    const position = norm(user.position), department = norm(user.department);
    const global = position.includes('ceo') || department === 'management';
    const departmentApprover = position.includes('manager') || position.includes('supervisor');
    return { global, allowed: global || (departmentApprover && !!department) };
}
function canAct(user, record, step) {
    if (!step || step.status !== 'Pending') return false;
    switch (norm(step.approver_role)) {
        case 'head of department':
            return isHOD(user) && !!norm(record.department) &&
                norm(user.department) === norm(record.department);
        case 'vgm': return norm(user.position) === 'vgm';
        case 'ceo': return norm(user.position) === 'ceo';
        case 'chairman': return norm(user.position) === 'chairman';
        case 'hr specialist': return norm(user.position) === 'hr specialist' && isHR(user);
        default: return false;
    }
}
function canRead(user, record) {
    const id = norm(user.user_id);
    return id === norm(record.requested_by) || id === norm(record.employee_id) ||
        isHR(user) || ['vgm', 'ceo', 'chairman'].includes(norm(user.position)) ||
        (isHOD(user) && !!norm(record.department) && norm(user.department) === norm(record.department));
}
function canOpenQueue(user) {
    return legacyAccess(user).allowed || isHOD(user) ||
        ['vgm', 'ceo', 'chairman', 'hr specialist'].includes(norm(user.position));
}
function validatePending(record, steps) {
    if (record.status !== 'Pending') throw problem(409, 'Request is already completed or rejected.');
    if (steps.length !== ROLES.length || !steps.every((s, i) =>
        Number(s.step_order) === i + 1 && norm(s.approver_role) === norm(ROLES[i]))) {
        throw problem(409, 'Approval steps are missing or invalid.');
    }
    const pending = steps.filter(s => s.status === 'Pending');
    if (pending.length !== 1) throw problem(409, 'Request must have exactly one current approval step.');
    const current = pending[0];
    if (!steps.every(s => s.step_order < current.step_order ? s.status === 'Approved' :
        s.step_order > current.step_order ? s.status === 'Waiting' : s.status === 'Pending')) {
        throw problem(409, 'Approval sequence is inconsistent.');
    }
    return current;
}
async function freshUser(connection, sessionUserId, lock = false) {
    const [rows] = await connection.query(
        'SELECT user_id, name, position, department FROM users WHERE user_id = ? LIMIT 1' +
        (lock ? ' FOR SHARE' : ''), [sessionUserId]);
    if (!rows.length) throw problem(401, 'Account not found. Please sign in again.');
    return rows[0];
}
async function decide(connection, sessionUserId, idValue, body) {
    const id = requestId(idValue);
    if (!body || !['Approved', 'Rejected'].includes(body.status)) {
        throw problem(400, 'Status must be Approved or Rejected.');
    }
    if (!Number.isInteger(body.step_order) || body.step_order < 1 || body.step_order > 5) {
        throw problem(400, 'Send the current step_order as an integer from 1 to 5.');
    }
    if (body.remarks != null && (typeof body.remarks !== 'string' || body.remarks.length > 2000)) {
        throw problem(400, 'Remarks must be text with at most 2000 characters.');
    }
    let started = false;
    try {
        await connection.beginTransaction(); started = true;
        const user = await freshUser(connection, sessionUserId, true);
        const [requests] = await connection.query(
            'SELECT id, department, requested_by, employee_id, status FROM resignations WHERE id = ? FOR UPDATE', [id]);
        if (!requests.length) throw problem(404, 'Resignation request not found.');
        const record = requests[0];
        if (!canRead(user, record)) throw problem(403, 'Access denied for this resignation request.');
        const [steps] = await connection.query(
            'SELECT * FROM resignation_approval_steps WHERE resignation_id = ? ORDER BY step_order FOR UPDATE', [id]);
        const current = validatePending(record, steps);
        if (Number(current.step_order) !== body.step_order) {
            throw problem(409, 'Approval step has changed. Reload the request before submitting.');
        }
        if (!canAct(user, record, current)) throw problem(403, 'You are not the approver for the current step.');
        const [changed] = await connection.query(
            "UPDATE resignation_approval_steps SET status = ?, acted_by = ?, acted_at = NOW(), remarks = ? WHERE id = ? AND status = 'Pending'",
            [body.status, user.user_id, body.remarks?.trim() || null, current.id]);
        if (changed.affectedRows !== 1) throw problem(409, 'Approval step has already changed.');
        let overall = 'Pending', next = null;
        if (body.status === 'Rejected') {
            overall = 'Rejected';
            await connection.query(
                "UPDATE resignation_approval_steps SET status = 'Cancelled' WHERE resignation_id = ? AND status = 'Waiting'", [id]);
        } else {
            next = steps.find(s => Number(s.step_order) === Number(current.step_order) + 1) || null;
            if (next) {
                const [activated] = await connection.query(
                    "UPDATE resignation_approval_steps SET status = 'Pending' WHERE id = ? AND status = 'Waiting'", [next.id]);
                if (activated.affectedRows !== 1) throw problem(409, 'Next approval step could not be activated.');
            } else overall = 'Approved';
        }
        if (overall !== 'Pending') {
            const [updated] = await connection.query(
                "UPDATE resignations SET status = ? WHERE id = ? AND status = 'Pending'", [overall, id]);
            if (updated.affectedRows !== 1) throw problem(409, 'Request has already changed.');
        }
        if (overall !== 'Pending') await enqueueOutcome(connection, record, overall);
        await connection.commit(); started = false;
        return { success: true, id, status: overall,
            completed_step: Number(current.step_order), decision: body.status,
            next_step: next ? { step_order: Number(next.step_order), approver_role: next.approver_role } : null };
    } catch (error) {
        if (started) await connection.rollback().catch(() => {});
        throw error;
    }
}
module.exports = { ROLES, norm, problem, requestId, isHOD, legacyAccess, canAct, canRead,
    canOpenQueue, validatePending, freshUser, decide };
