'use strict';

const mysql = require('mysql2/promise');
const db = require('../config/database');
const { sendEmail } = require('./email-service');
const { resolveApproverRecipients } = require('./p1-email');
const { buildEmail, loadDetails } = require('./request-email');

const TARGETS = {
    leave: {
        stepsTable: 'leave_approval_steps',
        foreignKey: 'leave_id'
    },

    travel: {
        stepsTable: 'travel_approval_steps',
        foreignKey: 'travel_id'
    },

    disbursement: {
        stepsTable: 'disbursement_approval_steps',
        foreignKey: 'disbursement_id'
    },

    loan: {
        stepsTable: 'loan_approval_steps',
        foreignKey: 'loan_id'
    },

    overtime: {
        stepsTable: 'overtime_approval_steps',
        foreignKey: 'overtime_id'
    }
};

async function saveWithApprovalSteps({
    type,
    insertQuery,
    values,
    roles,
    department,
    afterInsert = null
}) {
    const config = TARGETS[type];

    if (!config) {
        throw new Error(`Unsupported P1 workflow type: ${type}`);
    }

    if (
        !Array.isArray(roles) ||
        roles.length === 0 ||
        roles.some(role => !String(role || '').trim())
    ) {
        throw new Error('Approval roles are required.');
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
        await connection.beginTransaction();

        const [result] = await connection.query(
            insertQuery,
            values
        );

        if (typeof afterInsert === 'function') {
            await afterInsert(connection, result);
        }

        const approvalRows = roles.map((role, index) => [
            result.insertId,
            index + 1,
            `${role} Approval`,
            role,
            index === 0 ? 'Pending' : 'Waiting'
        ]);

        await connection.query(
            `
            INSERT INTO ${config.stepsTable} (
                ${config.foreignKey},
                step_order,
                step_label,
                approver_role,
                status
            )
            VALUES ?
            `,
            [approvalRows]
        );

        await connection.commit();
        try {
            const firstRole = roles[0];

            const recipients = await resolveApproverRecipients(
                connection,
                firstRole,
                department
            );

            if (!recipients.length) {
                console.warn(
                    `[EMAIL] No recipient found for first approver ${firstRole} ` +
                    `on REQ-${type.toUpperCase()}-${result.insertId}`
                );
            }

            for (const recipient of recipients) {
                const ref = `REQ-${type.toUpperCase()}-${result.insertId}`;
                const content = await buildEmail(connection, type, result.insertId, {
                    greeting: `Hi ${recipient.name || recipient.user_id},`,
                    paragraphs: [
                        `A ${type.toUpperCase()} request requires your approval (${firstRole}).`
                    ],
                    footer: 'Please log in to the FocusInsight OA System to review the request.'
                });
                await sendEmail({
                    to: recipient.email,
                    subject: `Approval Required: ${ref}`,
                    text: content.text,
                    html: content.html
                });
            }
        } catch (emailError) {
            console.error(
                '[EMAIL] First approver notification failed:',
                emailError.message
            );
        }

        // Confirmation to the person who applied, with the same details table.
        try {
            const ref = `REQ-${type.toUpperCase()}-${result.insertId}`;
            const details = await loadDetails(connection, type, result.insertId);
            const staffId = details && details.staffId;

            if (staffId) {
                const [userRows] = await connection.query(
                    'SELECT * FROM users WHERE LOWER(user_id) = LOWER(?) LIMIT 1',
                    [staffId]
                );
                const u = userRows && userRows[0];
                const staffEmail = u && (u.email || u.Email || u.email_address);

                if (!staffEmail) {
                    console.warn(`[EMAIL] No email found for requester ${staffId} (${ref}).`);
                } else {
                    const staffName = (u && (u.name || u.full_name || u.employee_name)) || staffId;
                    const content = await buildEmail(connection, type, result.insertId, {
                        greeting: `Hi ${staffName},`,
                        paragraphs: [
                            `Your ${type.toUpperCase()} request ${ref} has been submitted.`,
                            `It is now waiting for ${roles[0]} approval.`
                        ],
                        footer: 'Please log in to the FocusInsight OA System to track the request.'
                    });
                    await sendEmail({
                        to: staffEmail,
                        subject: `Request Submitted: ${ref}`,
                        text: content.text,
                        html: content.html
                    });
                }
            }
        } catch (staffEmailError) {
            console.error(
                '[EMAIL] Requester confirmation failed:',
                staffEmailError.message
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

module.exports = { saveWithApprovalSteps };