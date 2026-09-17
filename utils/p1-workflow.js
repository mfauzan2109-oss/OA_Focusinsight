'use strict';

const mysql = require('mysql2/promise');
const db = require('../config/database');

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

        return result;

    } catch (error) {
        await connection.rollback().catch(() => { });
        throw error;

    } finally {
        await connection.end().catch(() => { });
    }
}

module.exports = { saveWithApprovalSteps };