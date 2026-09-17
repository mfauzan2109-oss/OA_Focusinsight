'use strict';

const mysql = require('mysql2/promise');
const db = require('../config/database');
const { TARGETS, decide } = require('../utils/p1-approval');

const ACTORS = {
    'head of department': 'EMP890',
    'vgm': 'TEST_VGM',
    'ceo': 'CEO001',
    'chairman': 'TEST_CHAIR',
    'hr': 'TEST_HRS',
    'hr specialist': 'TEST_HRS',
    'project manager': 'MGR001'
};

function actorFor(type, role) {
    if (type === 'disbursement') {
        if (role === 'project manager') {
            return 'MGR001';
        }

        if (role === 'head of department') {
            return 'TEST_HOD_EE';
        }
    }

    return ACTORS[role];
}

const norm = value => String(value || '').trim().toLowerCase();

async function main() {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('P1 test runner cannot run in production.');
    }

    const [type, rawId, mode = 'approve-all'] = process.argv.slice(2);

    if (!type || !rawId) {
        console.log(
            'Usage: node scripts/test-p1-flow.js leave 89 approve-all'
        );
        process.exit(1);
    }

    const config = TARGETS[type];

    if (!config) {
        throw new Error(`Unsupported P1 type: ${type}`);
    }

    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error('Invalid request ID.');
    }

    const {
        host,
        port,
        user,
        password,
        database,
        socketPath,
        ssl,
        timezone
    } = db.config;

    const connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database,
        socketPath,
        ssl,
        timezone
    });

    try {
        console.log(`\nP1 FLOW TEST`);
        console.log(`Type : ${type}`);
        console.log(`ID   : ${id}`);
        console.log(`Mode : ${mode}\n`);

        for (let i = 0; i < 10; i++) {
            const [rows] = await connection.query(
                `
                SELECT step_order, approver_role, status
                FROM ${config.stepsTable}
                WHERE ${config.foreignKey} = ?
                  AND status = 'Pending'
                ORDER BY step_order
                LIMIT 1
                `,
                [id]
            );

            if (!rows.length) break;

            const step = rows[0];
            const role = norm(step.approver_role);
            const actor = actorFor(type, role);

            if (!actor) {
                throw new Error(
                    `No test actor configured for role: ${step.approver_role}`
                );
            }

            let decision = 'Approved';

            const rejectMatch = mode.match(/^reject-at=(.+)$/i);

            if (
                rejectMatch &&
                norm(rejectMatch[1]) === role
            ) {
                decision = 'Rejected';
            }

            const result = await decide(
                connection,
                type,
                actor,
                id,
                decision,
                'Automated P1 workflow test'
            );

            console.log(
                `Step ${step.step_order} | ` +
                `${step.approver_role} | ` +
                `${actor} → ${decision} ✅`
            );

            if (result.status !== 'Pending') {
                console.log(
                    `\nFinal status: ${result.status}\n`
                );
                break;
            }
        }

        let parentQuery;

        if (type === 'leave') {
            parentQuery = `
        SELECT id, \`Status\` AS status
        FROM \`leave\`
        WHERE id = ?
    `;
        } else if (type === 'travel') {
            parentQuery = `
        SELECT id, status
        FROM travel
        WHERE id = ?
    `;
        } else if (type === 'disbursement') {
            parentQuery = `
        SELECT
            id,
            status,
            total_amount,
            department
        FROM disbursements
        WHERE id = ?
    `;
        } else {
            throw new Error(`Parent display not configured for type: ${type}`);
        }

        const [parentRows] = await connection.query(parentQuery, [id]);

        const [steps] = await connection.query(
            `
            SELECT
                step_order,
                approver_role,
                status,
                acted_by
            FROM ${config.stepsTable}
            WHERE ${config.foreignKey} = ?
            ORDER BY step_order
            `,
            [id]
        );

        console.log('Parent:', parentRows[0] || null);
        console.table(steps);

    } finally {
        await connection.end().catch(() => { });
    }
}

main().catch(error => {
    console.error('\nTEST FAILED:', error.message);
    process.exit(1);
});