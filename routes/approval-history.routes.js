'use strict';

const express = require('express');
const mysql = require('mysql2/promise');

const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

function norm(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

async function openConnection() {
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

    return mysql.createConnection({
        host,
        port,
        user,
        password,
        database,
        socketPath,
        ssl,
        timezone
    });
}

function isHistoryApprover(user) {
    const position = norm(user.position);

    return [
        'manager',
        'head of department',
        'hod',
        'vgm'
    ].includes(position);
}

router.get(
    '/api/approval-history',
    requireLogin,
    async (req, res) => {
        let connection;

        res.set('Cache-Control', 'no-store');

        try {
            connection = await openConnection();

            const [users] = await connection.query(
                `
                SELECT
                    user_id,
                    name,
                    position,
                    department
                FROM users
                WHERE LOWER(user_id) = LOWER(?)
                LIMIT 1
                `,
                [req.session.user.user_id]
            );

            if (!users.length) {
                return res.status(401).json({
                    success: false,
                    message: 'Account not found.'
                });
            }

            const user = users[0];

            if (!isHistoryApprover(user)) {
                return res.status(403).json({
                    success: false,
                    message:
                        'Approval History is only available to Manager/HOD or VGM.'
                });
            }

            const actorUserId = user.user_id;

            const historyQuery = `
    SELECT *
    FROM (
        SELECT
            CONCAT('REQ-LEAVE-', l.ID) AS request_id,
            l.ID AS id,
            'Leave Application' AS request_type,
            l.\`Employee ID\` AS employee_id,
            l.\`Employee Name\` AS employee_name,
            l.Department AS department,
            NULL AS amount,
            l.\`Created At\` AS date_submitted,
            s.status AS decision,
            s.acted_at,
            s.remarks,
            s.step_order,
            s.approver_role
        FROM \`leave\` l
        JOIN leave_approval_steps s
            ON s.leave_id = l.ID
        WHERE LOWER(s.acted_by) = LOWER(?)
          AND s.status IN ('Approved', 'Rejected')

        UNION ALL

        SELECT
            CONCAT('REQ-TRAVEL-', t.id),
            t.id,
            'Travel Request',
            t.employee_id,
            t.employee_name,
            t.department,
            t.total_amount,
            t.created_at,
            s.status,
            s.acted_at,
            s.remarks,
            s.step_order,
            s.approver_role
        FROM travel t
        JOIN travel_approval_steps s
            ON s.travel_id = t.id
        WHERE LOWER(s.acted_by) = LOWER(?)
          AND s.status IN ('Approved', 'Rejected')

        UNION ALL

        SELECT
            CONCAT('REQ-DISBURSEMENT-', d.id),
            d.id,
            'Disbursement',
            d.employee_id,
            d.employee_name,
            d.department,
            d.total_amount,
            d.created_at,
            s.status,
            s.acted_at,
            s.remarks,
            s.step_order,
            s.approver_role
        FROM disbursements d
        JOIN disbursement_approval_steps s
            ON s.disbursement_id = d.id
        WHERE LOWER(s.acted_by) = LOWER(?)
          AND s.status IN ('Approved', 'Rejected')

        UNION ALL

        SELECT
            CONCAT('REQ-OVERTIME-', o.id),
            o.id,
            'Overtime Claim',
            o.employee_id,
            o.employee_name,
            o.department,
            o.total_claim,
            o.created_at,
            s.status,
            s.acted_at,
            s.remarks,
            s.step_order,
            s.approver_role
        FROM overtime o
        JOIN overtime_approval_steps s
            ON s.overtime_id = o.id
        WHERE LOWER(s.acted_by) = LOWER(?)
          AND s.status IN ('Approved', 'Rejected')

        UNION ALL

        SELECT
            CONCAT('REQ-LOAN-', l.id),
            l.id,
            'Loan',
            l.employee_id,
            l.employee_name,
            l.department,
            l.amount_requested,
            l.created_at,
            s.status,
            s.acted_at,
            s.remarks,
            s.step_order,
            s.approver_role
        FROM loans l
        JOIN loan_approval_steps s
            ON s.loan_id = l.id
        WHERE LOWER(s.acted_by) = LOWER(?)
          AND s.status IN ('Approved', 'Rejected')

        UNION ALL

        SELECT
            CONCAT('REQ-RESIGNATION-', r.id),
            r.id,
            'Resignation',
            r.employee_id,
            r.employee_name,
            r.department,
            NULL,
            r.created_at,
            s.status,
            s.acted_at,
            s.remarks,
            s.step_order,
            s.approver_role
        FROM resignations r
        JOIN resignation_approval_steps s
            ON s.resignation_id = r.id
        WHERE LOWER(s.acted_by) = LOWER(?)
          AND s.status IN ('Approved', 'Rejected')

        UNION ALL

        SELECT
            CONCAT('REQ-SALARY-', sa.id),
            sa.id,
            'Salary Adjustment',
            sa.employee_id,
            sa.employee_name,
            sa.employee_department,
            sa.adjustment_amount,
            sa.created_at,
            s.status,
            s.acted_at,
            s.remarks,
            s.step_order,
            s.approver_role
        FROM salary_adjustments sa
        JOIN salary_adjustment_approval_steps s
            ON s.salary_adjustment_id = sa.id
        WHERE LOWER(s.acted_by) = LOWER(?)
          AND s.status IN ('Approved', 'Rejected')

        UNION ALL

        SELECT
            CONCAT('REQ-JOB-TRANSFER-', jt.id),
            jt.id,
            'Job Transfer',
            jt.employee_id,
            jt.employee_name,
            jt.current_department,
            NULL,
            jt.created_at,
            s.status,
            s.acted_at,
            s.remarks,
            s.step_order,
            s.approver_role
        FROM job_transfer_requests jt
        JOIN job_transfer_approval_steps s
            ON s.job_transfer_id = jt.id
        WHERE LOWER(s.acted_by) = LOWER(?)
          AND s.status IN ('Approved', 'Rejected')

        UNION ALL

        SELECT
            CONCAT('REQ-PROBATION-', p.id),
            p.id,
            'Probation Confirmation',
            p.employee_id,
            p.employee_name,
            p.employee_department,
            NULL,
            p.created_at,
            s.status,
            s.acted_at,
            s.remarks,
            s.step_order,
            s.approver_role
        FROM probation_confirmations p
        JOIN probation_approval_steps s
            ON s.probation_id = p.id
        WHERE LOWER(s.acted_by) = LOWER(?)
          AND s.status IN ('Approved', 'Rejected')
    ) history
    ORDER BY acted_at DESC, id DESC
`;

            const params = Array(9).fill(actorUserId);

            const [historyRows] =
                await connection.query(
                    historyQuery,
                    params
                );

            const search =
                String(req.query.q || '')
                    .trim()
                    .toLowerCase();

            let filteredRows = historyRows;

            if (search) {
                filteredRows =
                    historyRows.filter(row => {
                        const searchable = [
                            row.request_id,
                            row.request_type,
                            row.employee_id,
                            row.employee_name,
                            row.department,
                            row.decision,
                            row.approver_role
                        ]
                            .join(' ')
                            .toLowerCase();

                        return searchable.includes(search);
                    });
            }

            const data =
                filteredRows.map(row => ({
                    ...row,

                    amount:
                        row.amount == null
                            ? 'Not Applicable'
                            : `RM ${Number(row.amount).toFixed(2)}`,

                    status: row.decision
                }));

            return res.json({
                success: true,
                count: data.length,
                data
            });
            
        } catch (error) {
            console.error(
                'Approval History Error:',
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    'Failed to load approval history.'
            });

        } finally {
            if (connection) {
                await connection.end().catch(() => { });
            }
        }
    }
);

module.exports = router;