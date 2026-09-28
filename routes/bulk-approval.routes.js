'use strict';

const express = require('express');
const mysql = require('mysql2/promise');

const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

const p1Approval = require('../utils/p1-approval');
const jobTransferApproval =
    require('../utils/job-transfer-approval');
const resignationApproval =
    require('../utils/resignation-approval');
const salaryAdjustmentApproval =
    require('../utils/salary-adjustment-approval');
const probationService =
    require('../utils/probation-service');

const router = express.Router();

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

function normalizeType(value) {
    const type = String(value || '')
        .trim()
        .toLowerCase();

    if (
        type === 'leave' ||
        type === 'leave application'
    ) {
        return 'leave';
    }

    if (
        type === 'travel' ||
        type === 'travel request'
    ) {
        return 'travel';
    }

    if (
        type === 'disbursement' ||
        type === 'disbursement request'
    ) {
        return 'disbursement';
    }

    if (
        type === 'overtime' ||
        type === 'overtime claim' ||
        type === 'ot'
    ) {
        return 'overtime';
    }

    if (
        type === 'loan' ||
        type === 'loan application'
    ) {
        return 'loan';
    }

    if (
        type === 'job transfer' ||
        type === 'job-transfer' ||
        type === 'job_transfer'
    ) {
        return 'job-transfer';
    }

    if (type === 'resignation') {
        return 'resignation';
    }

    if (
        type === 'salary adjustment' ||
        type === 'salary-adjustment' ||
        type === 'salary_adjustment'
    ) {
        return 'salary-adjustment';
    }

    if (
        type === 'probation' ||
        type === 'probation confirmation' ||
        type === 'probation-confirmation'
    ) {
        return 'probation';
    }

    return null;
}

async function processDecision(
    connection,
    userId,
    item,
    decision,
    remarks
) {
    const type = normalizeType(item.type);

    if (!type) {
        const error =
            new Error('Unsupported request type.');

        error.status = 400;

        throw error;
    }

    const id = item.id;

    if (
        type === 'leave' ||
        type === 'travel' ||
        type === 'disbursement' ||
        type === 'overtime' ||
        type === 'loan'
    ) {
        return p1Approval.decide(
            connection,
            type,
            userId,
            id,
            decision,
            remarks
        );
    }

    if (type === 'job-transfer') {
        return jobTransferApproval.decide(
            connection,
            userId,
            id,
            decision,
            remarks
        );
    }

    if (type === 'resignation') {
        return resignationApproval.decide(
            connection,
            userId,
            id,
            {
                status: decision,
                remarks
            }
        );
    }

    if (type === 'salary-adjustment') {
        return salaryAdjustmentApproval.decide(
            connection,
            userId,
            id,
            {
                status: decision,
                remarks
            }
        );
    }

    if (type === 'probation') {
        return probationService.decide(
            connection,
            userId,
            id,
            {
                status: decision,
                remarks
            }
        );
    }

    throw Object.assign(
        new Error('Unsupported request type.'),
        { status: 400 }
    );
}

router.put(
    '/api/approval-queue/bulk',
    requireLogin,
    async (req, res) => {
        const {
            requests,
            status,
            remarks = null
        } = req.body || {};

        if (
            !['Approved', 'Rejected'].includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Status must be Approved or Rejected.'
            });
        }

        if (
            !Array.isArray(requests) ||
            requests.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'At least one request must be selected.'
            });
        }

        if (requests.length > 50) {
            return res.status(400).json({
                success: false,
                message:
                    'Maximum 50 requests can be processed at once.'
            });
        }

        let connection;

        try {
            connection = await openConnection();

            const userId =
                req.session.user.user_id;

            const results = [];

            for (const item of requests) {
                try {
                    if (
                        !item ||
                        !item.id ||
                        !item.type
                    ) {
                        throw Object.assign(
                            new Error(
                                'Request ID and type are required.'
                            ),
                            { status: 400 }
                        );
                    }

                    const result =
                        await processDecision(
                            connection,
                            userId,
                            item,
                            status,
                            remarks
                        );

                    results.push({
                        id: item.id,
                        type: item.type,
                        success: true,
                        result
                    });

                } catch (error) {
                    results.push({
                        id: item?.id ?? null,
                        type: item?.type ?? null,
                        success: false,
                        status:
                            error.status || 500,
                        message:
                            error.message ||
                            'Unable to process request.'
                    });
                }
            }

            const succeeded =
                results.filter(
                    item => item.success
                ).length;

            const failed =
                results.length - succeeded;

            return res.json({
                success: failed === 0,
                requested: results.length,
                succeeded,
                failed,
                results
            });

        } catch (error) {
            console.error(
                'Bulk Approval Error:',
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to process bulk approval.'
            });

        } finally {
            if (connection) {
                await connection
                    .end()
                    .catch(() => {});
            }
        }
    }
);

module.exports = router;