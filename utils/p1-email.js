'use strict';

function norm(value) {
    return String(value || '').trim().toLowerCase();
}

function dedupeByEmail(rows) {
    const seen = new Map();

    for (const row of rows) {
        const email = String(row.email || '')
            .trim()
            .toLowerCase();

        if (!email) continue;

        if (!seen.has(email)) {
            seen.set(email, row);
        }
    }

    return Array.from(seen.values());
}

async function resolveApproverRecipients(
    connection,
    role,
    department = null
) {
    const cleanRole = norm(role);

    let sql = `
        SELECT user_id, name, email, position, department
        FROM users
        WHERE email IS NOT NULL
          AND TRIM(email) <> ''
    `;

    const params = [];

    if (cleanRole === 'head of department') {
        sql += `
            AND LOWER(TRIM(position)) IN (
                'manager',
                'head of department',
                'hod'
            )
            AND LOWER(TRIM(department)) = LOWER(TRIM(?))
        `;
        params.push(department);

    } else if (cleanRole === 'project manager') {
        sql += `
            AND LOWER(TRIM(position)) = 'project manager'
            AND LOWER(TRIM(department)) = LOWER(TRIM(?))
        `;
        params.push(department);

    } else if (cleanRole === 'vgm') {
        sql += `
            AND LOWER(TRIM(position)) = 'vgm'
        `;

    } else if (cleanRole === 'ceo') {
        sql += `
            AND LOWER(TRIM(position)) = 'ceo'
        `;

    } else if (cleanRole === 'chairman') {
        sql += `
            AND LOWER(TRIM(position)) = 'chairman'
        `;

    } else if (cleanRole === 'hr specialist') {
        sql += `
            AND LOWER(TRIM(position)) = 'hr specialist'
            AND LOWER(TRIM(department)) IN (
                'hr',
                'human resources'
            )
        `;

    } else if (cleanRole === 'hr') {
        sql += `
    AND LOWER(TRIM(department)) IN (
        'hr',
        'human resources'
    )
    AND LOWER(TRIM(position)) IN (
        'manager',
        'hr',
        'hr specialist'
    )
`;

    } else {
        return [];
    }

    sql += ` ORDER BY user_id`;

    const [rows] = await connection.query(
        sql,
        params
    );

    return dedupeByEmail(rows);
}

async function resolveOutcomeRecipients(
    connection,
    requesterId,
    ccTable,
    includeCc = false
) {
    const recipientIds = new Map();

    recipientIds.set(
        norm(requesterId),
        {
            id: requesterId,
            kind: 'outcome'
        }
    );

    if (includeCc) {
        const [ccRows] = await connection.query(
            `SELECT user_id FROM ${ccTable} ORDER BY user_id`
        );

        for (const row of ccRows) {
            const key = norm(row.user_id);

            if (!recipientIds.has(key)) {
                recipientIds.set(key, {
                    id: row.user_id,
                    kind: 'cc'
                });
            }
        }
    }

    const entries = Array.from(recipientIds.values());

    if (!entries.length) {
        return [];
    }

    const conditions = entries
        .map(() => 'LOWER(user_id) = LOWER(?)')
        .join(' OR ');

    const [users] = await connection.query(
        `
        SELECT user_id, name, email
        FROM users
        WHERE (${conditions})
          AND email IS NOT NULL
          AND TRIM(email) <> ''
        `,
        entries.map(entry => entry.id)
    );

    const resolved = users.map(user => {
        const entry = entries.find(
            item => norm(item.id) === norm(user.user_id)
        );

        return {
            ...user,
            kind: entry ? entry.kind : 'outcome'
        };
    });

    return dedupeByEmail(resolved);
}

module.exports = {
    resolveApproverRecipients,
    resolveOutcomeRecipients
};