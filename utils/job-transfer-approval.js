'use strict';

const norm = value => String(value || '').trim().toLowerCase();

function problem(status, message) {
    return Object.assign(new Error(message), { status });
}

function requestId(value) {
    const raw = String(value);

    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
        throw problem(400, 'Invalid request ID.');
    }

    return Number(raw);
}

function isHOD(user) {
    return ['manager', 'head of department', 'hod'].includes(
        norm(user && user.position)
    );
}

function isHRSpecialist(user) {
    return (
        norm(user && user.position) === 'hr specialist' &&
        ['hr', 'human resources'].includes(norm(user && user.department))
    );
}

function canAct(user, step) {
    if (!user || !step || step.status !== 'Pending') return false;

    const role = norm(step.approver_role);

    if (role === 'head of department') {
        return (
            isHOD(user) &&
            norm(user.department) === norm(step.approver_department)
        );
    }

    if (role === 'vgm') {
        return norm(user.position) === 'vgm';
    }

    if (role === 'hr specialist') {
        return isHRSpecialist(user);
    }

    return false;
}

function validatePending(steps) {
    const pending = steps.filter(step => step.status === 'Pending');

    if (pending.length !== 1) {
        throw problem(
            409,
            'Request must have exactly one current approval step.'
        );
    }

    const current = pending[0];

    const valid = steps.every(step => {
        if (Number(step.step_order) < Number(current.step_order)) {
            return step.status === 'Approved';
        }

        if (Number(step.step_order) > Number(current.step_order)) {
            return step.status === 'Waiting';
        }

        return step.status === 'Pending';
    });

    if (!valid) {
        throw problem(409, 'Approval sequence is inconsistent.');
    }

    return current;
}

async function freshUser(connection, userId, lock = false) {
    const [rows] = await connection.query(
        `
        SELECT user_id, name, position, department
        FROM users
        WHERE LOWER(user_id) = LOWER(?)
        LIMIT 1
        ${lock ? 'FOR SHARE' : ''}
        `,
        [userId]
    );

    if (!rows.length) {
        throw problem(401, 'Approver account not found.');
    }

    return rows[0];
}

async function queue(connection, actorUserId) {
    const user = await freshUser(connection, actorUserId);

    const [rows] = await connection.query(`
        SELECT
            jt.id,
            jt.employee_id,
            jt.employee_name,
            jt.current_department AS department,
            jt.new_department,
            jt.transfer_type,
            jt.created_at AS date_submitted,
            jt.status,
            s.step_order,
            s.step_label,
            s.approver_role,
            s.approver_department,
            s.status AS step_status
        FROM job_transfer_requests jt
        INNER JOIN job_transfer_approval_steps s
            ON s.job_transfer_id = jt.id
        WHERE jt.status = 'Pending'
          AND s.status = 'Pending'
        ORDER BY jt.created_at DESC, jt.id DESC
    `);

    return rows
        .filter(row => canAct(user, row))
        .map(row => ({
            ...row,
            request_type: 'Job Transfer',
            amount: 'Not Applicable',
            table_source: 'job_transfer_requests',
            can_approve: true
        }));
}

async function decide(
    connection,
    actorUserId,
    idValue,
    decision,
    remarks = null
) {
    const id = requestId(idValue);

    if (!['Approved', 'Rejected'].includes(decision)) {
        throw problem(400, 'Decision must be Approved or Rejected.');
    }

    let started = false;

    try {
        await connection.beginTransaction();
        started = true;

        const user = await freshUser(connection, actorUserId, true);

        const [records] = await connection.query(`
            SELECT
                id,
                employee_id,
                employee_name,
                transfer_type,
                current_department,
                new_department,
                status
            FROM job_transfer_requests
            WHERE id = ?
            FOR UPDATE
        `, [id]);

        if (!records.length) {
            throw problem(404, 'Job Transfer request not found.');
        }

        const record = records[0];

        if (record.status !== 'Pending') {
            throw problem(409, 'Request is already completed or rejected.');
        }

        const [steps] = await connection.query(`
            SELECT *
            FROM job_transfer_approval_steps
            WHERE job_transfer_id = ?
            ORDER BY step_order
            FOR UPDATE
        `, [id]);

        const current = validatePending(steps);

        if (!canAct(user, current)) {
            throw problem(
                403,
                'User is not authorized for the current approval step.'
            );
        }

        const [changed] = await connection.query(`
            UPDATE job_transfer_approval_steps
            SET
                status = ?,
                acted_by = ?,
                acted_at = NOW(),
                remarks = ?
            WHERE id = ?
              AND status = 'Pending'
        `, [decision, user.user_id, remarks, current.id]);

        if (changed.affectedRows !== 1) {
            throw problem(409, 'Approval step has already changed.');
        }

        let overall = 'Pending';
        let next = null;

        if (decision === 'Rejected') {
            overall = 'Rejected';

            await connection.query(`
                UPDATE job_transfer_approval_steps
                SET status = 'Cancelled'
                WHERE job_transfer_id = ?
                  AND status = 'Waiting'
            `, [id]);
        } else {
            next = steps.find(step =>
                Number(step.step_order) === Number(current.step_order) + 1
            ) || null;

            if (next) {
                const [activated] = await connection.query(`
                    UPDATE job_transfer_approval_steps
                    SET status = 'Pending'
                    WHERE id = ?
                      AND status = 'Waiting'
                `, [next.id]);

                if (activated.affectedRows !== 1) {
                    throw problem(
                        409,
                        'Next approval step could not be activated.'
                    );
                }
            } else {
                overall = 'Approved';
            }
        }

        if (overall !== 'Pending') {
            const [updated] = await connection.query(`
                UPDATE job_transfer_requests
                SET status = ?
                WHERE id = ?
                  AND status = 'Pending'
            `, [overall, id]);

            if (updated.affectedRows !== 1) {
                throw problem(409, 'Parent request has already changed.');
            }
        }

        await connection.commit();
        started = false;

        return {
            success: true,
            id,
            decision,
            completed_step: Number(current.step_order),
            status: overall,
            next_step: next
                ? {
                    step_order: Number(next.step_order),
                    approver_role: next.approver_role,
                    approver_department: next.approver_department
                }
                : null
        };
    } catch (error) {
        if (started) {
            await connection.rollback().catch(() => {});
        }

        throw error;
    }
}

module.exports = {
    norm,
    problem,
    canAct,
    validatePending,
    freshUser,
    queue,
    decide
};