'use strict';

const mysql = require('mysql2/promise');
const db = require('../config/database');

const norm = value => String(value || '').trim().toLowerCase();
const problem = (status, message) => Object.assign(new Error(message), { status });

const isHOD = user =>
    ['manager', 'head of department', 'hod'].includes(norm(user.position));

const isHR = user =>
    ['hr', 'human resources'].includes(norm(user.department)) ||
    ['hr', 'human resources', 'hr specialist'].includes(norm(user.position));

async function saveJobTransferWithWorkflow({
    sessionUserId, employeeId, transferType, newDepartment, saveRequest
}) {
    if (!norm(sessionUserId)) {
        throw problem(401, 'Please sign in again.');
    }

    if (
        typeof employeeId !== 'string' ||
        !employeeId.trim() ||
        employeeId.trim().length > 50
    ) {
        throw problem(400, 'Please provide a valid Employee ID.');
    }

    if (!['Department', 'Position', 'Location'].includes(transferType)) {
        throw problem(400, 'Please select a valid Transfer Type.');
    }

    if (typeof saveRequest !== 'function') {
        throw new Error('saveRequest must be a function.');
    }

    const {
        host, port, user, password, database, socketPath, ssl, timezone
    } = db.config;

    const connection = await mysql.createConnection({
        host, port, user, password, database, socketPath, ssl, timezone
    });

    let started = false;

    try {
        await connection.beginTransaction();
        started = true;

        const [users] = await connection.query(`
            SELECT user_id, name, department, position
            FROM users
            WHERE LOWER(TRIM(user_id)) IN (?, ?)
               OR LOWER(TRIM(position)) IN (
                   'manager', 'head of department', 'hod',
                   'vgm', 'hr specialist'
               )
        `, [norm(sessionUserId), norm(employeeId)]);

        const actor = users.find(row =>
            norm(row.user_id) === norm(sessionUserId));

        const employee = users.find(row =>
            norm(row.user_id) === norm(employeeId));

        if (!actor) {
            throw problem(401, 'Account not found. Please sign in again.');
        }

        if (!employee) {
            throw problem(404, 'Employee not found.');
        }

        const currentDepartment = String(employee.department || '').trim();

        const sameDepartment = !!currentDepartment &&
            norm(actor.department) === norm(currentDepartment);

        const isOwner = norm(actor.user_id) === norm(employee.user_id);

        if (!isOwner && !isHR(actor) && !(isHOD(actor) && sameDepartment)) {
            throw problem(403, 'You cannot submit a transfer for this employee.');
        }

        if (!currentDepartment || currentDepartment.length > 100) {
            throw problem(400, 'Please complete the employee department in their profile.');
        }

        // Position or Location transfers keep the existing department.
        const target = transferType === 'Department'
            ? newDepartment
            : currentDepartment;

        if (
            typeof target !== 'string' ||
            !target.trim() ||
            target.trim().length > 100
        ) {
            throw problem(400, 'Please provide a valid New Department.');
        }

        const originalHOD = users.find(row =>
            isHOD(row) &&
            norm(row.department) === norm(currentDepartment));

        const newHOD = users.find(row =>
            isHOD(row) &&
            norm(row.department) === norm(target));

        if (!originalHOD) {
            throw problem(409, 'No HOD is configured for the current department.');
        }

        if (!newHOD) {
            throw problem(400, 'New Department must match a department with a HOD.');
        }

        if (!users.some(row => norm(row.position) === 'vgm')) {
            throw problem(409, 'No VGM approver is configured.');
        }

        if (!users.some(row => norm(row.position) === 'hr specialist')) {
            throw problem(409, 'No HR Specialist approver is configured.');
        }

        const targetDepartment = String(newHOD.department).trim();

        const [result] = await saveRequest(connection, {
            employee,
            currentDepartment,
            targetDepartment
        });

        const steps = [
            [1, 'Original HOD Approval', 'Head of Department', currentDepartment, 'Pending'],
            [2, 'VGM Approval', 'VGM', null, 'Waiting'],
            [3, 'New HOD Approval', 'Head of Department', targetDepartment, 'Waiting'],
            [4, 'HR Specialist Approval', 'HR Specialist', null, 'Waiting']
        ];

        await connection.query(`
            INSERT INTO job_transfer_approval_steps
                (job_transfer_id, step_order, step_label,
                 approver_role, approver_department, status)
            VALUES ?
        `, [steps.map(step => [result.insertId, ...step])]);

        await connection.commit();
        started = false;

        return result;
    } catch (error) {
        if (started) {
            await connection.rollback().catch(() => {});
        }

        throw error;
    } finally {
        await connection.end().catch(() => {});
    }
}

module.exports = { saveJobTransferWithWorkflow };