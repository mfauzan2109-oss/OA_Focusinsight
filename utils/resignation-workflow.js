const mysql = require('mysql2/promise');
const db = require('../config/database');

async function saveResignationWithWorkflow(insertQuery, values) {
    // Connection khas supaya transaction tidak bercampur
    // dengan query request lain.
    const {
        host, port, user, password, database,
        socketPath, ssl, timezone
    } = db.config;

    const connection = await mysql.createConnection({
        host, port, user, password, database,
        socketPath, ssl, timezone
    });

    try {
        await connection.beginTransaction();

        const [steps] = await connection.query(`
            SELECT step_order, step_label, approver_role
            FROM workflows
            WHERE workflow_type = 'resignation'
            ORDER BY step_order
            FOR SHARE
        `);

        const expectedRoles = [
            'Head of Department',
            'VGM',
            'CEO',
            'Chairman',
            'HR Specialist'
        ];

        const validWorkflow =
            steps.length === expectedRoles.length &&
            steps.every((step, index) =>
                Number(step.step_order) === index + 1 &&
                step.approver_role === expectedRoles[index]
            );

        if (!validWorkflow) {
            throw new Error(
                'Resignation workflow configuration is incomplete or invalid.'
            );
        }

        const [result] = await connection.query(
            insertQuery,
            values
        );

        const approvalRows = steps.map((step, index) => [
            result.insertId,
            step.step_order,
            step.step_label,
            step.approver_role,
            index === 0 ? 'Pending' : 'Waiting'
        ]);

        await connection.query(`
            INSERT INTO resignation_approval_steps (
                resignation_id,
                step_order,
                step_label,
                approver_role,
                status
            )
            VALUES ?
        `, [approvalRows]);

        await connection.commit();

        return result;
    } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
    } finally {
        await connection.end().catch(() => {});
    }
}

module.exports = { saveResignationWithWorkflow };