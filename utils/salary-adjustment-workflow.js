const mysql = require('mysql2/promise');
const db = require('../config/database');

async function saveSalaryAdjustmentWithWorkflow(insertQuery, values) {
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
            WHERE workflow_type = 'salary_adjustment'
            ORDER BY step_order
            FOR SHARE
        `);

        const expectedRoles = [
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
                'Salary Adjustment workflow configuration is incomplete or invalid.'
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
            INSERT INTO salary_adjustment_approval_steps (
                salary_adjustment_id,
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

module.exports = {
    saveSalaryAdjustmentWithWorkflow
};