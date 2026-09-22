const { sendEmail } = require('./email-service');
const { resolveApproverRecipients } = require('./p1-email');
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

        try {
            const [records] = await connection.query(
                `
        SELECT department
        FROM resignations
        WHERE id = ?
        LIMIT 1
        `,
                [result.insertId]
            );

            const department =
                records.length ? records[0].department : null;

            const firstRole = expectedRoles[0];

            const recipients = await resolveApproverRecipients(
                connection,
                firstRole,
                department
            );

            if (!recipients.length) {
                console.warn(
                    `[EMAIL] No recipient found for first approver ${firstRole} ` +
                    `on REQ-RESIGNATION-${result.insertId}`
                );
            }

            for (const recipient of recipients) {
                await sendEmail({
                    to: recipient.email,
                    subject:
                        `Approval Required: REQ-RESIGNATION-${result.insertId}`,
                    text:
                        `Hi ${recipient.name || recipient.user_id},\n\n` +
                        `A Resignation request requires your approval.\n` +
                        `Request: REQ-RESIGNATION-${result.insertId}\n` +
                        `Role: ${firstRole}\n\n` +
                        `Please log in to the FocusInsight OA System to review the request.`
                });
            }
        } catch (emailError) {
            console.error(
                '[EMAIL] Resignation first approver notification failed:',
                emailError.message
            );
        }

        return result;
    } catch (error) {
        await connection.rollback().catch(() => { });
        throw error;
    } finally {
        await connection.end().catch(() => { });
    }
}

module.exports = { saveResignationWithWorkflow };