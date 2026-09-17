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

const TARGETS = {
    leave: {
        stepsTable: 'leave_approval_steps',
        foreignKey: 'leave_id',
        ccTable: 'leave_cc_recipients',
        notificationsTable: 'leave_notifications',
        notificationForeignKey: 'leave_id',

        parentQuery: `
            SELECT id,
                   \`Employee ID\` AS employee_id,
                   \`Department\` AS department,
                   \`Status\` AS status
            FROM \`leave\`
            WHERE id = ?
            FOR UPDATE
        `,

        updateParentQuery: `
            UPDATE \`leave\`
            SET \`Status\` = ?
            WHERE id = ?
              AND \`Status\` = 'Pending'
        `,

        notificationPrefix: 'LEAVE'
    },

    travel: {
        stepsTable: 'travel_approval_steps',
        foreignKey: 'travel_id',
        ccTable: 'travel_cc_recipients',
        notificationsTable: 'travel_notifications',
        notificationForeignKey: 'travel_id',

        parentQuery: `
            SELECT id, employee_id, department, status
            FROM travel
            WHERE id = ?
            FOR UPDATE
        `,

        updateParentQuery: `
            UPDATE travel
            SET status = ?
            WHERE id = ?
              AND status = 'Pending'
        `,

        notificationPrefix: 'TRAVEL'
    },

    disbursement: {
        stepsTable: 'disbursement_approval_steps',
        foreignKey: 'disbursement_id',
        ccTable: 'disbursement_cc_recipients',
        notificationsTable: 'disbursement_notifications',
        notificationForeignKey: 'disbursement_id',

        parentQuery: `
        SELECT id, employee_id, department, status
        FROM disbursements
        WHERE id = ?
        FOR UPDATE
    `,

        updateParentQuery: `
        UPDATE disbursements
        SET status = ?
        WHERE id = ?
          AND status = 'Pending'
    `,

        notificationPrefix: 'DISBURSEMENT'
    }
};

function isHOD(user) {
    const pos = norm(user.position);

    return (
        pos === 'manager' ||
        pos === 'head of department' ||
        pos === 'hod'
    );
}

function isHR(user) {
    const dept = norm(user.department);
    const pos = norm(user.position);

    return (
        dept === 'hr' ||
        dept === 'human resources' ||
        pos === 'hr' ||
        pos === 'hr specialist'
    );
}

function canAct(user, record, step) {
    if (!step || step.status !== 'Pending') return false;

    const role = norm(step.approver_role);

    if (role === 'head of department') {
        return (
            isHOD(user) &&
            norm(user.department) === norm(record.department)
        );
    }

    if (role === 'vgm') {
        return norm(user.position) === 'vgm';
    }

    if (role === 'ceo') {
        return norm(user.position) === 'ceo';
    }

    if (role === 'chairman') {
        return norm(user.position) === 'chairman';
    }

    if (role === 'hr') {
        return isHR(user);
    }

    if (role === 'hr specialist') {
        return norm(user.position) === 'hr specialist' && isHR(user);
    }

    if (role === 'project manager') {
        return (
            norm(user.position) === 'project manager' &&
            norm(user.department) === norm(record.department)
        );
    }

    return false;
}

async function freshUser(connection, userId, lock = false) {
    const [rows] = await connection.query(
        `
        SELECT user_id, name, position, department
        FROM users
        WHERE user_id = ?
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

async function enqueueOutcome(connection, config, record, status) {
    const message =
        `REQ-${config.notificationPrefix}-${record.id}: ${status}`;

    await connection.query(
        `
        INSERT INTO ${config.notificationsTable}
            (${config.notificationForeignKey}, recipient_id, outcome, kind, message)
        VALUES (?, ?, ?, 'outcome', ?)
        ON DUPLICATE KEY UPDATE id = id
        `,
        [
            record.id,
            record.employee_id,
            status,
            message
        ]
    );

    if (status !== 'Approved') return;

    const [ccRows] = await connection.query(`
        SELECT c.user_id
        FROM ${config.ccTable} c
        INNER JOIN users u
            ON u.user_id = c.user_id
    `);

    for (const row of ccRows) {
        if (norm(row.user_id) === norm(record.employee_id)) continue;

        await connection.query(
            `
            INSERT INTO ${config.notificationsTable}
                (${config.notificationForeignKey}, recipient_id, outcome, kind, message)
            VALUES (?, ?, ?, 'cc', ?)
            ON DUPLICATE KEY UPDATE id = id
            `,
            [
                record.id,
                row.user_id,
                status,
                `${message} (CC)`
            ]
        );
    }
}

async function decide(
    connection,
    type,
    actorUserId,
    idValue,
    decision,
    remarks = null
) {
    const config = TARGETS[type];

    if (!config) {
        throw problem(400, `Unsupported P1 type: ${type}`);
    }

    const id = requestId(idValue);

    if (!['Approved', 'Rejected'].includes(decision)) {
        throw problem(400, 'Decision must be Approved or Rejected.');
    }

    let started = false;

    try {
        await connection.beginTransaction();
        started = true;

        const user = await freshUser(
            connection,
            actorUserId,
            true
        );

        const [records] = await connection.query(
            config.parentQuery,
            [id]
        );

        if (!records.length) {
            throw problem(404, 'Request not found.');
        }

        const record = records[0];

        if (record.status !== 'Pending') {
            throw problem(
                409,
                'Request is already completed or rejected.'
            );
        }

        const [steps] = await connection.query(
            `
            SELECT *
            FROM ${config.stepsTable}
            WHERE ${config.foreignKey} = ?
            ORDER BY step_order
            FOR UPDATE
            `,
            [id]
        );

        const current = validatePending(steps);

        if (!canAct(user, record, current)) {
            throw problem(
                403,
                'User is not authorized for the current approval step.'
            );
        }

        const [changed] = await connection.query(
            `
            UPDATE ${config.stepsTable}
            SET
                status = ?,
                acted_by = ?,
                acted_at = NOW(),
                remarks = ?
            WHERE id = ?
              AND status = 'Pending'
            `,
            [
                decision,
                user.user_id,
                remarks,
                current.id
            ]
        );

        if (changed.affectedRows !== 1) {
            throw problem(409, 'Approval step has already changed.');
        }

        let overall = 'Pending';
        let next = null;

        if (decision === 'Rejected') {
            overall = 'Rejected';

            await connection.query(
                `
                UPDATE ${config.stepsTable}
                SET status = 'Cancelled'
                WHERE ${config.foreignKey} = ?
                  AND status = 'Waiting'
                `,
                [id]
            );

        } else {
            next =
                steps.find(
                    step =>
                        Number(step.step_order) ===
                        Number(current.step_order) + 1
                ) || null;

            if (next) {
                const [activated] = await connection.query(
                    `
                    UPDATE ${config.stepsTable}
                    SET status = 'Pending'
                    WHERE id = ?
                      AND status = 'Waiting'
                    `,
                    [next.id]
                );

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
            const [updated] = await connection.query(
                config.updateParentQuery,
                [overall, id]
            );

            if (updated.affectedRows !== 1) {
                throw problem(
                    409,
                    'Parent request has already changed.'
                );
            }

            record.id = id;

            await enqueueOutcome(
                connection,
                config,
                record,
                overall
            );
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
                    approver_role: next.approver_role
                }
                : null
        };

    } catch (error) {
        if (started) {
            await connection.rollback().catch(() => { });
        }

        throw error;
    }
}

module.exports = {
    TARGETS,
    norm,
    canAct,
    freshUser,
    validatePending,
    decide
};