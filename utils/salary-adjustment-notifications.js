'use strict';

// Caller owns the approval transaction.
// Module ini cuma simpan notification dalam database.

async function enqueueOutcome(
    connection,
    record,
    status
) {
    if (
        !['Approved', 'Rejected'].includes(status)
    ) {
        return;
    }

    // 1. Pastikan requester masih wujud
    const [requesters] =
        await connection.query(
            `
            SELECT user_id
            FROM users
            WHERE LOWER(user_id) = LOWER(?)
            FOR SHARE
            `,
            [record.requested_by]
        );

    if (requesters.length !== 1) {
        throw new Error(
            'Salary Adjustment requester account is missing.'
        );
    }

    // Requester akan dapat final outcome
    const recipients = new Map([
        [
            requesters[0].user_id.toLowerCase(),
            {
                id: requesters[0].user_id,
                kind: 'outcome'
            }
        ]
    ]);

    // 2. CC Relevant HR hanya selepas Approved
    if (status === 'Approved') {
        const [cc] =
            await connection.query(`
                SELECT
                    c.user_id,
                    u.user_id AS resolved_id
                FROM salary_adjustment_cc_recipients c
                LEFT JOIN users u
                    ON u.user_id = c.user_id
                ORDER BY c.user_id
                FOR SHARE
            `);

        for (const recipient of cc) {
            if (!recipient.resolved_id) {
                throw new Error(
                    'Configured Salary Adjustment CC account is missing.'
                );
            }

            const key =
                recipient.resolved_id.toLowerCase();

            // Elak duplicate kalau requester sendiri
            // kebetulan berada dalam CC list
            if (!recipients.has(key)) {
                recipients.set(
                    key,
                    {
                        id: recipient.resolved_id,
                        kind: 'cc'
                    }
                );
            }
        }
    }

    // 3. Simpan notification
    for (const recipient of recipients.values()) {
        await connection.query(
            `
            INSERT INTO salary_adjustment_notifications
            (
                salary_adjustment_id,
                recipient_id,
                outcome,
                kind,
                message
            )
            VALUES (?, ?, ?, ?, ?)

            ON DUPLICATE KEY UPDATE id = id
            `,
            [
                record.id,
                recipient.id,
                status,
                recipient.kind,
                `REQ-SALARY-ADJUSTMENT-${record.id}: ${status}${
                    recipient.kind === 'cc'
                        ? ' (CC)'
                        : ''
                }`
            ]
        );
    }
}

async function listNotifications(
    connection,
    userId,
    before
) {
    if (
        before !== undefined &&
        (
            !/^[1-9]\d*$/.test(String(before)) ||
            !Number.isSafeInteger(Number(before))
        )
    ) {
        throw Object.assign(
            new Error('Invalid before cursor.'),
            { status: 400 }
        );
    }

    const values = [userId];

    if (before !== undefined) {
        values.push(Number(before));
    }

    const [rows] =
        await connection.query(
            `
            SELECT
                id AS notification_id,
                salary_adjustment_id AS id,
                'Salary Adjustment' AS type,
                CONCAT(
                    'REQ-SALARY-ADJUSTMENT-',
                    salary_adjustment_id
                ) AS form_no,
                outcome AS status,
                kind,
                message,
                created_at AS time
            FROM salary_adjustment_notifications
            WHERE recipient_id = ?
            ${
                before === undefined
                    ? ''
                    : 'AND id < ?'
            }
            ORDER BY id DESC
            LIMIT 101
            `,
            values
        );

    const notifications =
        rows.slice(0, 100);

    return {
        success: true,
        notifications,
        next_before:
            rows.length > 100
                ? notifications[99].notification_id
                : null
    };
}

module.exports = {
    enqueueOutcome,
    listNotifications
};