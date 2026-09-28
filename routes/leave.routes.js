const express = require('express');

const db = require('../config/database');
const upload = require('../middleware/upload');
const { requireLogin } = require('../middleware/auth');
const { getAnnualEntitlement, getSickEntitlement, isWeekend, countBusinessDays } = require('../utils/helpers');
const { saveWithApprovalSteps } = require('../utils/p1-workflow');

const router = express.Router();

function normalizeLeaveDayType(value) {
    const type = String(value || '')
        .trim()
        .toLowerCase();

    if (
        type === 'full' ||
        type === 'full-day' ||
        type === 'full day'
    ) {
        return 'full';
    }

    if (
        type === 'half-am' ||
        type === 'half day am' ||
        type === 'half day (am)'
    ) {
        return 'half-am';
    }

    if (
        type === 'half-pm' ||
        type === 'half day pm' ||
        type === 'half day (pm)'
    ) {
        return 'half-pm';
    }

    return null;
}

function calculateLeaveEntry(entry) {
    const startDate = String(entry.start_date || '').trim();
    const endDate = String(entry.end_date || '').trim();
    const dayType = normalizeLeaveDayType(entry.day_type);

    if (!startDate || !endDate || !dayType) {
        throw new Error(
            'Each leave entry requires Start Date, End Date and Day Type.'
        );
    }

    const startObj = new Date(`${startDate}T00:00:00`);
    const endObj = new Date(`${endDate}T00:00:00`);

    if (
        Number.isNaN(startObj.getTime()) ||
        Number.isNaN(endObj.getTime()) ||
        endObj < startObj
    ) {
        throw new Error('Invalid leave date range.');
    }

    if (isWeekend(startObj) || isWeekend(endObj)) {
        throw new Error(
            'Leave Start Date and End Date must fall on a weekday.'
        );
    }

    let duration;

    if (dayType === 'half-am' || dayType === 'half-pm') {
        if (startDate !== endDate) {
            throw new Error(
                'Half Day leave must use the same Start Date and End Date.'
            );
        }

        duration = 0.5;
    } else {
        duration = countBusinessDays(
            startDate,
            endDate
        );
    }

    if (duration <= 0) {
        throw new Error(
            'The selected leave entry contains no working days.'
        );
    }

    return {
        start_date: startDate,
        end_date: endDate,
        day_type: dayType,
        duration
    };
}

function parseLeaveEntries(body) {
    let rawEntries =
        body.entries ??
        body.leave_entries ??
        null;

    // Frontend lama tidak hantar multiple entries.
    if (
        rawEntries === null ||
        rawEntries === undefined ||
        rawEntries === ''
    ) {
        return null;
    }

    // multipart/form-data normally sends the array as JSON text.
    if (typeof rawEntries === 'string') {
        try {
            rawEntries = JSON.parse(rawEntries);
        } catch (error) {
            throw new Error(
                'Leave entries must be valid JSON.'
            );
        }
    }

    if (
        !Array.isArray(rawEntries) ||
        rawEntries.length === 0
    ) {
        throw new Error(
            'At least one leave entry is required.'
        );
    }

    // Safety limit. One application should not contain
    // an unreasonable number of separate rows.
    if (rawEntries.length > 31) {
        throw new Error(
            'Too many leave entries in one application.'
        );
    }

    const entries =
        rawEntries.map((entry, index) => {
            try {
                return calculateLeaveEntry(entry);
            } catch (error) {
                throw new Error(
                    `Leave entry ${index + 1}: ${error.message}`
                );
            }
        });

    // Do not allow rows inside the same application
    // to overlap each other.
    for (let i = 0; i < entries.length; i++) {
        for (
            let j = i + 1;
            j < entries.length;
            j++
        ) {
            const first = entries[i];
            const second = entries[j];

            const overlap =
                first.start_date <= second.end_date &&
                first.end_date >= second.start_date;

            if (overlap) {
                throw new Error(
                    `Leave entry ${i + 1} overlaps with leave entry ${j + 1}.`
                );
            }
        }
    }

    return entries;
}

router.get('/api/user-leave-info', requireLogin, (req, res) => {
    const userId = req.session.user.user_id;

    const userQuery = 'SELECT join_date FROM users WHERE LOWER(user_id) = LOWER(?)';

    db.query(userQuery, [userId], (err, userResults) => {
        let yearsOfService = 1;

        if (!err && userResults.length > 0 && userResults[0].join_date) {
            const joinDate = new Date(userResults[0].join_date);
            const now = new Date();
            const diffTime = Math.abs(now - joinDate);
            yearsOfService = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25)));
        }

        const annualEntitlement = getAnnualEntitlement(yearsOfService);
        const sickEntitlement = getSickEntitlement(yearsOfService);
        const hospitalEntitlement = 60;

        const leaveQuery = `
            SELECT \`Leave Type\` as leave_type, \`No of Days\` as num_days, \`Start Date\` as start_date, \`End Date\` as end_date, Status
            FROM \`leave\`
            WHERE LOWER(\`Employee ID\`) = LOWER(?) AND LOWER(TRIM(Status)) != 'rejected'
        `;

        db.query(leaveQuery, [userId], (leaveErr, leaveResults) => {
            if (leaveErr) {
                console.error('Fetch Leave Balance Error:', leaveErr);
                return res.status(500).json({ success: false, message: 'Database error.' });
            }

            let usedAnnual = 0;
            let usedSick = 0;
            let usedHospital = 0;
            const bookedDates = [];

            (leaveResults || []).forEach(row => {
                const days = parseFloat(row.num_days || 0);
                const lType = (row.leave_type || '').toLowerCase();

                if (lType.includes('annual')) usedAnnual += days;
                else if (lType.includes('sick')) usedSick += days;
                else if (lType.includes('hospital')) usedHospital += days;

                if (row.start_date && row.end_date) {
                    let cur = new Date(row.start_date);
                    const end = new Date(row.end_date);
                    while (cur <= end) {
                        bookedDates.push(cur.toISOString().split('T')[0]);
                        cur.setDate(cur.getDate() + 1);
                    }
                }
            });

            return res.json({
                success: true,
                yearsOfService: yearsOfService,
                usedAnnualLeave: usedAnnual,
                bookedDates: bookedDates,
                balances: {
                    annual: {
                        entitlement: annualEntitlement,
                        used: usedAnnual,
                        remaining: Math.max(0, annualEntitlement - usedAnnual)
                    },
                    sick: {
                        entitlement: sickEntitlement,
                        used: usedSick,
                        remaining: Math.max(0, sickEntitlement - usedSick)
                    },
                    hospitalization: {
                        entitlement: hospitalEntitlement,
                        used: usedHospital,
                        remaining: Math.max(0, hospitalEntitlement - usedHospital)
                    }
                }
            });
        });
    });
});

router.get('/api/leave-balance', requireLogin, (req, res) => {
    const employeeId = req.session.user.user_id;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    const balanceQuery = `
        SELECT
            leave_type,
            entitlement,
            carried_forward,
            carried_forward_expires
        FROM leave_balances
        WHERE LOWER(employee_id) = LOWER(?)
          AND year = ?
        ORDER BY FIELD(
            leave_type,
            'Annual Leave',
            'Sick Leave',
            'Hospitalization',
            'Maternity',
            'Paternity'
        )
    `;

    db.query(balanceQuery, [employeeId, year], (balanceErr, balances) => {
        if (balanceErr) {
            console.error('Leave balance query error:', balanceErr);
            return res.status(500).json({
                success: false,
                message: 'Failed to load leave balance.'
            });
        }

        const usedQuery = `
            SELECT
                CASE
                    WHEN LOWER(TRIM(\`Leave Type\`)) IN ('annual', 'annual leave')
                        THEN 'Annual Leave'
                    WHEN LOWER(TRIM(\`Leave Type\`)) IN ('sick', 'sick leave')
                        THEN 'Sick Leave'
                    WHEN LOWER(TRIM(\`Leave Type\`)) IN ('hospitalization', 'medical leave')
                        THEN 'Hospitalization'
                    WHEN LOWER(TRIM(\`Leave Type\`)) = 'maternity'
                        THEN 'Maternity'
                    WHEN LOWER(TRIM(\`Leave Type\`)) = 'paternity'
                        THEN 'Paternity'
                    ELSE NULL
                END AS leave_type,
                SUM(\`No of Days\`) AS used
            FROM \`leave\`
            WHERE LOWER(\`Employee ID\`) = LOWER(?)
              AND YEAR(\`Start Date\`) = ?
              AND LOWER(TRIM(\`Status\`)) NOT IN ('rejected', 'cancelled')
            GROUP BY leave_type
        `;

        db.query(usedQuery, [employeeId, year], (usedErr, usedRows) => {
            if (usedErr) {
                console.error('Leave usage query error:', usedErr);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to calculate leave usage.'
                });
            }

            const usedMap = {};

            (usedRows || []).forEach(row => {
                if (row.leave_type) {
                    usedMap[row.leave_type] = Number(row.used || 0);
                }
            });

            const today = new Date();

            const data = (balances || []).map(row => {
                const entitlement = Number(row.entitlement || 0);

                let carriedForward = Number(row.carried_forward || 0);

                if (
                    row.carried_forward_expires &&
                    new Date(row.carried_forward_expires) < today
                ) {
                    carriedForward = 0;
                }

                const used = usedMap[row.leave_type] || 0;
                const remaining = Math.max(
                    0,
                    entitlement + carriedForward - used
                );

                return {
                    leave_type: row.leave_type,
                    entitlement,
                    carried_forward: carriedForward,
                    used,
                    remaining
                };
            });

            return res.json({
                success: true,
                year,
                data
            });
        });
    });
});

router.post('/api/submit-leave', requireLogin, upload.single('attachment'), (req, res) => {
    const employee_id = req.session.user.user_id;
    const employee_name = req.session.user.name;
    const department = req.session.user.department;

    let leave_type = req.body.leave_type;
    if (leave_type === 'others' && req.body.leave_type_others) {
        leave_type = req.body.leave_type_others;
    }

    const reason = req.body.reason;
    const attachment_path = req.file
        ? `uploads/${req.file.filename}`
        : null;

    let leaveEntries;

    try {
        const parsedEntries =
            parseLeaveEntries(req.body);

        // New frontend:
        // entries / leave_entries array is provided.
        if (parsedEntries) {
            leaveEntries = parsedEntries;

            // Old frontend:
            // keep supporting the existing single date range.
        } else {
            leaveEntries = [
                calculateLeaveEntry({
                    start_date: req.body.start_date,
                    end_date: req.body.end_date,
                    day_type: req.body.day_type
                })
            ];
        }

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    const num_days =
        leaveEntries.reduce(
            (total, entry) =>
                total + Number(entry.duration || 0),
            0
        );

    if (num_days <= 0) {
        return res.status(400).json({
            success: false,
            message:
                'Total leave duration must be greater than 0.'
        });
    }

    // Master Leave record still keeps a summary date range
    // for My Request / Approval Queue compatibility.
    const start_date =
        leaveEntries
            .map(entry => entry.start_date)
            .sort()[0];

    const end_date =
        leaveEntries
            .map(entry => entry.end_date)
            .sort()
            .slice(-1)[0];

    const uniqueDayTypes =
        [
            ...new Set(
                leaveEntries.map(
                    entry => entry.day_type
                )
            )
        ];

    const day_type =
        uniqueDayTypes.length === 1
            ? uniqueDayTypes[0]
            : 'mixed';

    const overlapConditions =
        leaveEntries.map(() => `
        (
            e.start_date <= ?
            AND e.end_date >= ?
        )
    `).join(' OR ');

    const masterOverlapConditions =
        leaveEntries.map(() => `
        (
            l.\`Start Date\` <= ?
            AND l.\`End Date\` >= ?
        )
    `).join(' OR ');

    const overlapParams = [];

    // Exact overlap using child rows.
    leaveEntries.forEach(entry => {
        overlapParams.push(
            entry.end_date,
            entry.start_date
        );
    });

    // Backward compatibility for old leave records
    // that do not have leave_date_entries yet.
    leaveEntries.forEach(entry => {
        overlapParams.push(
            entry.end_date,
            entry.start_date
        );
    });

    const overlapQuery = `
    SELECT DISTINCT
        l.ID AS id,
        l.\`Start Date\` AS start_date,
        l.\`End Date\` AS end_date,
        l.Status AS status
    FROM \`leave\` l
    WHERE LOWER(l.\`Employee ID\`) = LOWER(?)
      AND LOWER(TRIM(l.Status)) IN (
          'pending',
          'approved'
      )
      AND (
          EXISTS (
              SELECT 1
              FROM leave_date_entries e
              WHERE e.leave_id = l.ID
                AND (
                    ${overlapConditions}
                )
          )

          OR

          (
              NOT EXISTS (
                  SELECT 1
                  FROM leave_date_entries old_entry
                  WHERE old_entry.leave_id = l.ID
              )
              AND (
                  ${masterOverlapConditions}
              )
          )
      )
`;

    db.query(
        overlapQuery,
        [employee_id, ...overlapParams],
        (overlapErr, overlapResults) => {

            if (overlapErr) {
                console.error(
                    'Overlap Check SQL Error:',
                    overlapErr
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Failed to check existing leave requests.'
                });
            }

            if (
                overlapResults &&
                overlapResults.length > 0
            ) {
                return res.status(409).json({
                    success: false,
                    message:
                        'One or more selected leave dates overlap with an existing Pending or Approved leave request.'
                });
            }

            const query = `
            INSERT INTO \`leave\`
            (
                \`Employee ID\`,
                \`Employee Name\`,
                \`Department\`,
                \`Leave Type\`,
                \`Start Date\`,
                \`End Date\`,
                \`Day type\`,
                \`No of Days\`,
                \`Reason\`,
                \`Supporting Documen\`,
                \`Status\`,
                \`Created At\`
            )
            VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, 'Pending', NOW()
            )
        `;

            const roles = [
                'Head of Department'
            ];

            if (num_days > 3) {
                roles.push('VGM');
            }

            if (num_days > 5) {
                roles.push(
                    'CEO',
                    'Chairman'
                );
            }

            roles.push('HR');

            saveWithApprovalSteps({
                type: 'leave',

                insertQuery: query,

                values: [
                    employee_id,
                    employee_name,
                    department,
                    leave_type,
                    start_date,
                    end_date,
                    day_type,
                    num_days,
                    reason,
                    attachment_path
                ],

                roles,
                department,

                afterInsert: async (
                    connection,
                    result
                ) => {

                    const entryRows =
                        leaveEntries.map(
                            (entry, index) => [
                                result.insertId,
                                index + 1,
                                entry.start_date,
                                entry.end_date,
                                entry.day_type,
                                entry.duration
                            ]
                        );

                    await connection.query(
                        `
                    INSERT INTO leave_date_entries
                    (
                        leave_id,
                        entry_order,
                        start_date,
                        end_date,
                        day_type,
                        duration
                    )
                    VALUES ?
                    `,
                        [entryRows]
                    );
                }
            })
                .then(result => {
                    return res.json({
                        success: true,
                        id: result.insertId,
                        total_days: num_days,
                        entries: leaveEntries,
                        message:
                            'Leave application submitted successfully!'
                    });
                })
                .catch(err => {
                    console.error(
                        'Leave workflow error:',
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            'Failed to submit leave application.'
                    });
                });
        }
    );
});

module.exports = router;
