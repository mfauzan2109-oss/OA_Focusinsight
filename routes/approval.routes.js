const express = require('express');

const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.get('/api/approval-queue', requireLogin, (req, res) => {
    const sessionUser = req.session.user;

    const userDept =
        String(sessionUser.department || '').trim();

    const userPos =
        String(sessionUser.position || '')
            .trim()
            .toLowerCase();

    const isGlobalApprover =
        userPos.includes('ceo') ||
        userDept.toLowerCase() === 'management';

    const isDepartmentApprover =
        userPos.includes('manager') ||
        userPos.includes('supervisor');

    if (!isGlobalApprover && !isDepartmentApprover) {
        return res.status(403).json({
            success: false,
            message:
                'Access Denied: Only authorized approvers can access the approval queue.'
        });
    }

    if (!isGlobalApprover && !userDept) {
        return res.status(403).json({
            success: false,
            message:
                'Access Denied: Approver department is unavailable.'
        });
    }

    let leaveQuery = `
        SELECT
            ID AS id,
            \`Employee ID\` AS employee_id,
            \`Employee Name\` AS employee_name,
            Department AS department,
            'Leave' AS request_type,
            'Not Applicable' AS amount,
            \`Created At\` AS date_submitted,
            last_reminder_sent,
            TRIM(Status) AS status
        FROM \`leave\`
        WHERE 1=1
    `;

    let disQuery = `
        SELECT
            id,
            employee_id,
            employee_name,
            department,
            'Disbursement' AS request_type,
            total_amount AS amount,
            created_at AS date_submitted,
            last_reminder_sent,
            TRIM(status) AS status
        FROM \`disbursements\`
        WHERE 1=1
    `;

    let travelQuery = `
        SELECT
            id,
            employee_id,
            employee_name,
            department,
            'Travel' AS request_type,
            total_amount AS amount,
            created_at AS date_submitted,
            last_reminder_sent,
            TRIM(status) AS status
        FROM \`travel\`
        WHERE 1=1
    `;

    let otQuery = `
        SELECT
            id,
            employee_id,
            employee_name,
            department,
            'Overtime' AS request_type,
            total_claim AS amount,
            created_at AS date_submitted,
            last_reminder_sent,
            TRIM(status) AS status
        FROM \`overtime\`
        WHERE 1=1
    `;

    let loanQuery = `
        SELECT
            id,
            employee_id,
            employee_name,
            department,
            'Loan' AS request_type,
            amount_requested AS amount,
            created_at AS date_submitted,
            last_reminder_sent,
            TRIM(status) AS status
        FROM \`loans\`
        WHERE 1=1
    `;

    const params =
        isGlobalApprover ? [] : [userDept];

    if (!isGlobalApprover) {
        leaveQuery += `
            AND LOWER(TRIM(Department))
                = LOWER(TRIM(?))
        `;

        disQuery += `
            AND LOWER(TRIM(department))
                = LOWER(TRIM(?))
        `;

        travelQuery += `
            AND LOWER(TRIM(department))
                = LOWER(TRIM(?))
        `;

        otQuery += `
            AND LOWER(TRIM(department))
                = LOWER(TRIM(?))
        `;

        loanQuery += `
            AND LOWER(TRIM(department))
                = LOWER(TRIM(?))
        `;
    }

    db.query(leaveQuery, params, (err1, leaveResults) => {
        db.query(disQuery, params, (err2, disResults) => {
            db.query(travelQuery, params, (err3, travelResults) => {
                db.query(otQuery, params, (err4, otResults) => {
                    db.query(loanQuery, params, (err5, loanResults) => {

                        if (
                            err1 ||
                            err2 ||
                            err3 ||
                            err4 ||
                            err5
                        ) {
                            console.error(
                                'Approval Queue Query Error:',
                                err1 || err2 || err3 || err4 || err5
                            );

                            return res.status(500).json({
                                success: false,
                                message:
                                    'Failed to load approval queue.'
                            });
                        }

                        const combinedQueue = [];

                        (leaveResults || []).forEach(row =>
                            combinedQueue.push({
                                ...row,
                                table_source: 'leave'
                            })
                        );

                        (disResults || []).forEach(row =>
                            combinedQueue.push({
                                ...row,
                                amount:
                                    `RM ${parseFloat(row.amount || 0).toFixed(2)}`,
                                table_source: 'disbursements'
                            })
                        );

                        (travelResults || []).forEach(row =>
                            combinedQueue.push({
                                ...row,
                                amount:
                                    `RM ${parseFloat(row.amount || 0).toFixed(2)}`,
                                table_source: 'travel'
                            })
                        );

                        (otResults || []).forEach(row =>
                            combinedQueue.push({
                                ...row,
                                amount:
                                    `RM ${parseFloat(row.amount || 0).toFixed(2)}`,
                                table_source: 'overtime'
                            })
                        );

                        (loanResults || []).forEach(row =>
                            combinedQueue.push({
                                ...row,
                                amount:
                                    `RM ${parseFloat(row.amount || 0).toFixed(2)}`,
                                table_source: 'loans'
                            })
                        );

                        let resignationQuery = `
    SELECT
        id,
        requested_by,
        requested_by_name,
        employee_id,
        employee_name,
        department,
        'Resignation' AS request_type,
        'Not Applicable' AS amount,
        created_at AS date_submitted,
        last_reminder_sent,
        TRIM(status) AS status
    FROM resignations
`;

                        const resignationParams = [];

                        if (!isGlobalApprover) {
                            resignationQuery += `
        WHERE LOWER(TRIM(department)) = LOWER(TRIM(?))
    `;
                            resignationParams.push(userDept);
                        }

                        db.query(
                            resignationQuery,
                            resignationParams,
                            (resignationErr, resignationResults) => {
                                if (resignationErr) {
                                    console.error(
                                        'Approval Queue Resignation Error:',
                                        resignationErr
                                    );

                                    return res.status(500).json({
                                        success: false,
                                        message: 'Failed to load resignation requests.'
                                    });
                                }

                                (resignationResults || []).forEach(row => {
                                    combinedQueue.push({
                                        ...row,
                                        table_source: 'resignations'
                                    });
                                });

                                combinedQueue.sort(
                                    (a, b) =>
                                        new Date(b.date_submitted) -
                                        new Date(a.date_submitted)
                                );

                                return res.json({
                                    success: true,
                                    data: combinedQueue
                                });
                            }
                        );
                    });
                });
            });
        });
    });
});

router.put(
    '/api/approval-queue/:type/:id',
    requireLogin,
    (req, res) => {

        const { type, id } = req.params;
        const { status } = req.body;

        const allowedStatuses = [
            'Pending',
            'Approved',
            'Rejected'
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request status.'
            });
        }

        const requestId = parseInt(id, 10);

        if (Number.isNaN(requestId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request ID.'
            });
        }

        const reqType =
            String(type || '')
                .trim()
                .toLowerCase();

        let tableName;
        let idColumn;
        let departmentColumn;
        let statusColumn;

        if (reqType === 'leave') {
            tableName = 'leave';
            idColumn = 'ID';
            departmentColumn = 'Department';
            statusColumn = 'Status';

        } else if (reqType === 'disbursement') {
            tableName = 'disbursements';
            idColumn = 'id';
            departmentColumn = 'department';
            statusColumn = 'status';

        } else if (reqType === 'travel') {
            tableName = 'travel';
            idColumn = 'id';
            departmentColumn = 'department';
            statusColumn = 'status';

        } else if (reqType === 'overtime') {
            tableName = 'overtime';
            idColumn = 'id';
            departmentColumn = 'department';
            statusColumn = 'status';

        } else if (
            reqType === 'loan' ||
            reqType === 'loans'
        ) {
            tableName = 'loans';
            idColumn = 'id';
            departmentColumn = 'department';
            statusColumn = 'status';

        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid request type.'
            });
        }

        const sessionUser = req.session.user;

        const userDepartment =
            String(sessionUser.department || '')
                .trim()
                .toLowerCase();

        const userPosition =
            String(sessionUser.position || '')
                .trim()
                .toLowerCase();

        const isGlobalApprover =
            userPosition.includes('ceo') ||
            userDepartment === 'management';

        const isDepartmentApprover =
            userPosition.includes('manager') ||
            userPosition.includes('supervisor');

        if (
            !isGlobalApprover &&
            !isDepartmentApprover
        ) {
            return res.status(403).json({
                success: false,
                message:
                    'Access Denied: You are not authorized to approve requests.'
            });
        }

        const lookupQuery = `
            SELECT
                \`${idColumn}\` AS id,
                \`${departmentColumn}\` AS department
            FROM \`${tableName}\`
            WHERE \`${idColumn}\` = ?
            LIMIT 1
        `;

        db.query(
            lookupQuery,
            [requestId],
            (lookupErr, lookupResults) => {

                if (lookupErr) {
                    console.error(
                        'Approval Lookup Error:',
                        lookupErr
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            'Failed to verify request.'
                    });
                }

                if (
                    !lookupResults ||
                    lookupResults.length === 0
                ) {
                    return res.status(404).json({
                        success: false,
                        message: 'Request not found.'
                    });
                }

                const requestDepartment =
                    String(
                        lookupResults[0].department || ''
                    )
                        .trim()
                        .toLowerCase();

                if (
                    !isGlobalApprover &&
                    userDepartment !== requestDepartment
                ) {
                    return res.status(403).json({
                        success: false,
                        message:
                            'Access Denied: You can only approve requests from your own department.'
                    });
                }

                const updateQuery = `
                    UPDATE \`${tableName}\`
                    SET \`${statusColumn}\` = ?
                    WHERE \`${idColumn}\` = ?
                `;

                db.query(
                    updateQuery,
                    [status, requestId],
                    (updateErr, result) => {

                        if (updateErr) {
                            console.error(
                                'Approval Update Error:',
                                updateErr
                            );

                            return res.status(500).json({
                                success: false,
                                message:
                                    'Failed to update request status.'
                            });
                        }

                        if (result.affectedRows === 0) {
                            return res.status(404).json({
                                success: false,
                                message: 'Request not found.'
                            });
                        }

                        return res.json({
                            success: true,
                            message:
                                `Request status updated to ${status}.`
                        });
                    }
                );
            }
        );
    }
);

module.exports = router;
