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

    if (
        type === '24hr' ||
        type === '24 hr' ||
        type === '24 hours'
    ) {
        return '24hr';
    }

    if (
        type === '48hr' ||
        type === '48 hr' ||
        type === '48 hours'
    ) {
        return '48hr';
    }

    return null;
}

function calculateLeaveEntry(entry) {
    const startDate = String(
        entry.start_date ??
        entry.start ??
        ''
    ).trim();

    const endDate = String(
        entry.end_date ??
        entry.end ??
        ''
    ).trim();

    const dayType = normalizeLeaveDayType(
        entry.day_type ??
        entry.dayType
    );

    if (!startDate || !endDate || !dayType) {
        throw new Error(
            'Each leave entry requires Start Date, End Date and Day Type.'
        );
    }

    const startObj =
        new Date(`${startDate}T00:00:00`);

    const endObj =
        new Date(`${endDate}T00:00:00`);

    if (
        Number.isNaN(startObj.getTime()) ||
        Number.isNaN(endObj.getTime()) ||
        endObj < startObj
    ) {
        throw new Error(
            'Invalid leave date range.'
        );
    }

    if (
        isWeekend(startObj) ||
        isWeekend(endObj)
    ) {
        throw new Error(
            'Leave Start Date and End Date must fall on a weekday.'
        );
    }

    let duration;

    if (
        dayType === 'half-am' ||
        dayType === 'half-pm'
    ) {
        if (startDate !== endDate) {
            throw new Error(
                'Half Day leave must use the same Start Date and End Date.'
            );
        }

        duration = 0.5;

    } else if (dayType === '24hr') {
        duration = 1;

    } else if (dayType === '48hr') {
        duration = 2;

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

// Leave balance table on the leave forms (leave.html, hr/leave-application-hr.html).
// Entitlement + carry-forward come from the leave_balances table; Annual/Sick fall
// back to the tenure-based helpers when an employee has no row yet. "Used" counts
// fully Approved requests only (Pending/Rejected/Cancelled don't count) for the current year.
const BALANCE_TYPES = [
    { key: 'annual', label: 'Annual Leave' },
    { key: 'sick', label: 'Sick Leave' },
    { key: 'hospitalization', label: 'Hospitalization' },
    { key: 'maternity', label: 'Maternity' },
    { key: 'paternity', label: 'Paternity' },
    { key: 'compassionate', label: 'Compassionate' }
];
const BALANCE_DEFAULTS = { hospitalization: 60, maternity: 98, paternity: 7, compassionate: 7 };

function balanceKeyFor(rawType) {
    const t = String(rawType || '').trim().toLowerCase();
    if (t === 'annual' || t === 'annual leave') return 'annual';
    if (t === 'sick' || t === 'sick leave') return 'sick';
    if (t === 'hospitalization' || t === 'medical leave') return 'hospitalization';
    if (t === 'maternity') return 'maternity';
    if (t === 'paternity') return 'paternity';
    if (t === 'compassionate') return 'compassionate';
    return null;
}

// ---------------------------------------------------------------------------
// Annual leave: carry forward + current year
// Rules:
//  - Entitlement follows years of service (getAnnualEntitlement: Y1=12, Y2=14, Y3=16 ...)
//  - Unused CURRENT-YEAR balance at year end carries forward, max 6 days.
//  - Carry forward is only valid until 30 June of the next year, then it shows 0.
//  - Leave must be taken from carry forward FIRST, then from current-year entitlement.
//  - Carry forward does not chain (unused carry forward is never carried again).
// ---------------------------------------------------------------------------
const MAX_CARRY_FORWARD = 6;

function computeAnnualBalance(leaveRows, joinYear, yearsOfService, currentYear, today) {
    const byYear = {};
    (leaveRows || []).forEach(r => {
        const sd = String(r.sd || '');
        const y = parseInt(sd.slice(0, 4), 10);
        if (!y) return;
        const days = parseFloat(r.num_days) || 0;
        if (!byYear[y]) byYear[y] = { total: 0, early: 0 };
        byYear[y].total += days;
        if (sd.slice(5, 10) <= '06-30') byYear[y].early += days; // can draw on carry forward
    });

    const startYear = Math.max(currentYear - 10, Math.min(joinYear || currentYear, currentYear));
    let carry = 0;

    for (let y = startYear; y <= currentYear; y++) {
        const entitlement = getAnnualEntitlement(Math.max(1, yearsOfService - (currentYear - y)));
        const u = byYear[y] || { total: 0, early: 0 };

        const carryUsed = Math.min(carry, u.early);        // carry forward is used first
        const currentUsed = u.total - carryUsed;
        const currentRemaining = Math.max(0, entitlement - currentUsed);

        if (y === currentYear) {
            const expiry = new Date(currentYear, 5, 30);   // 30 June
            const expired = today > expiry;
            const carryRemaining = expired ? 0 : Math.max(0, carry - carryUsed);
            return {
                entitlement,
                used: u.total,
                carryRemaining,
                currentRemaining,
                totalRemaining: carryRemaining + currentRemaining,
                expiry: `${currentYear}-06-30`
            };
        }
        carry = Math.min(MAX_CARRY_FORWARD, currentRemaining);
    }
}

// A leave counts against the balance ONLY when every approval step is Approved
// (HOD -> VGM -> CEO -> Chairman -> HR). We check leave_approval_steps directly
// instead of leave.Status, because Status may change before the last approver signs.
// Old leaves that have no step rows fall back to Status = 'Approved'.
const FULLY_APPROVED_CORE_SQL = `
    (
        (
            EXISTS (SELECT 1 FROM leave_approval_steps s1 WHERE s1.leave_id = l.ID)
            AND NOT EXISTS (
                SELECT 1 FROM leave_approval_steps s2
                WHERE s2.leave_id = l.ID AND LOWER(TRIM(s2.status)) <> 'approved'
            )
        )
        OR (
            NOT EXISTS (SELECT 1 FROM leave_approval_steps s3 WHERE s3.leave_id = l.ID)
            AND LOWER(TRIM(l.Status)) = 'approved'
        )
    )
`;
const FULLY_APPROVED_SQL = `
    LOWER(TRIM(l.Status)) NOT IN ('rejected', 'cancelled')
    AND ${FULLY_APPROVED_CORE_SQL}
`;
// Submitted but not yet fully approved (still waiting for approvers).
const PENDING_SQL = `
    LOWER(TRIM(l.Status)) NOT IN ('rejected', 'cancelled')
    AND NOT ${FULLY_APPROVED_CORE_SQL}
`;

function dbQuery(sql, params) {
    return new Promise((resolve, reject) => {
        db.query(sql, params || [], (err, rows) => (err ? reject(err) : resolve(rows)));
    });
}

// Balances for one employee in the current year.
// used    = fully approved leave only (this is what the table shows)
// pending = leave still waiting for approvers (only used to block over-applying)
async function getLeaveBalances(userId) {
    const year = new Date().getFullYear();

    let years = 1;
    let joinYear = null;
    const userRows = await dbQuery('SELECT join_date FROM users WHERE LOWER(user_id) = LOWER(?)', [userId]).catch(() => []);
    if (userRows && userRows.length > 0 && userRows[0].join_date) {
        joinYear = new Date(userRows[0].join_date).getFullYear();
        const diff = Math.abs(new Date() - new Date(userRows[0].join_date));
        years = Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
    }

    const balRows = await dbQuery(`
        SELECT leave_type, entitlement, carried_forward,
               DATE_FORMAT(carried_forward_expires, '%Y-%m-%d') AS carried_forward_expires
        FROM leave_balances
        WHERE LOWER(employee_id) = LOWER(?) AND year = ?
    `, [userId, year]);

    const usedRows = await dbQuery(`
        SELECT l.\`Leave Type\` AS leave_type, SUM(l.\`No of Days\`) AS used
        FROM \`leave\` l
        WHERE LOWER(l.\`Employee ID\`) = LOWER(?)
          AND ${FULLY_APPROVED_SQL}
          AND YEAR(l.\`Start Date\`) = ?
        GROUP BY l.\`Leave Type\`
    `, [userId, year]);

    const pendingRows = await dbQuery(`
        SELECT l.\`Leave Type\` AS leave_type, SUM(l.\`No of Days\`) AS pending
        FROM \`leave\` l
        WHERE LOWER(l.\`Employee ID\`) = LOWER(?)
          AND ${PENDING_SQL}
          AND YEAR(l.\`Start Date\`) = ?
        GROUP BY l.\`Leave Type\`
    `, [userId, year]);

    const histRows = await dbQuery(`
        SELECT DATE_FORMAT(l.\`Start Date\`, '%Y-%m-%d') AS sd, l.\`No of Days\` AS num_days
        FROM \`leave\` l
        WHERE LOWER(l.\`Employee ID\`) = LOWER(?)
          AND LOWER(TRIM(l.\`Leave Type\`)) IN ('annual', 'annual leave')
          AND ${FULLY_APPROVED_SQL}
    `, [userId]);

    const usedMap = {};
    (usedRows || []).forEach(r => {
        const key = balanceKeyFor(r.leave_type);
        if (key) usedMap[key] = (usedMap[key] || 0) + (parseFloat(r.used) || 0);
    });
    const pendingMap = {};
    (pendingRows || []).forEach(r => {
        const key = balanceKeyFor(r.leave_type);
        if (key) pendingMap[key] = (pendingMap[key] || 0) + (parseFloat(r.pending) || 0);
    });
    const rowMap = {};
    (balRows || []).forEach(r => {
        const key = balanceKeyFor(r.leave_type);
        if (key) rowMap[key] = r;
    });

    const annual = computeAnnualBalance(histRows, joinYear, years, year, new Date());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const data = BALANCE_TYPES.map(t => {
        if (t.key === 'annual') {
            return {
                key: t.key,
                leave_type: t.label,
                entitlement: annual.entitlement,
                carried_forward: annual.carryRemaining,
                carried_forward_expires: annual.expiry,
                current_year_remaining: annual.currentRemaining,
                used: annual.used,
                pending: pendingMap.annual || 0,
                remaining: annual.totalRemaining
            };
        }

        const row = rowMap[t.key];
        let entitlement;
        let carried = 0;

        if (row) {
            entitlement = parseFloat(row.entitlement) || 0;
            carried = parseFloat(row.carried_forward) || 0;
            if (carried > 0 && row.carried_forward_expires && new Date(row.carried_forward_expires) < today) {
                carried = 0;
            }
        } else if (t.key === 'sick') {
            entitlement = getSickEntitlement(years);
        } else {
            entitlement = BALANCE_DEFAULTS[t.key];
        }

        const used = usedMap[t.key] || 0;
        return {
            key: t.key,
            leave_type: t.label,
            entitlement: entitlement,
            carried_forward: carried,
            carried_forward_expires: (carried > 0 && row) ? row.carried_forward_expires : null,
            used: used,
            pending: pendingMap[t.key] || 0,
            remaining: Math.max(0, entitlement + carried - used)
        };
    });

    return { year, data };
}

router.get('/api/leave-balance', requireLogin, async (req, res) => {
    // Always the logged-in user; the employee_id query param the forms send is ignored.
    try {
        const result = await getLeaveBalances(req.session.user.user_id);
        return res.json({ success: true, data: result.data });
    } catch (err) {
        console.error('Leave Balance Error:', err);
        return res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// Blocks applications that exceed the balance (approved usage + other pending requests).
// Only entries starting in the current year are checked.
async function checkLeaveBalance(userId, leaveType, leaveEntries) {
    const key = balanceKeyFor(leaveType);
    if (!key) return null; // unpaid, marriage, replacement, others: no entitlement to check

    const { year, data } = await getLeaveBalances(userId);
    const row = data.find(r => r.key === key);
    if (!row) return null;

    const inYear = leaveEntries.filter(e => String(e.start_date).slice(0, 4) === String(year));
    const requested = inYear.reduce((sum, e) => sum + Number(e.duration || 0), 0);
    if (requested <= 0) return null;

    let available;
    if (key === 'annual') {
        // Carry forward can only be used by leave starting on or before 30 June.
        const earlyDays = inYear
            .filter(e => String(e.start_date).slice(5, 10) <= '06-30')
            .reduce((sum, e) => sum + Number(e.duration || 0), 0);
        const carryUsable = Math.min(Number(row.carried_forward) || 0, earlyDays);
        available = Number(row.current_year_remaining) + carryUsable - row.pending;
    } else {
        available = Number(row.remaining) - row.pending;
    }
    available = Math.max(0, available);

    if (requested > available) {
        const pendingNote = row.pending > 0 ? ` (including ${row.pending} day(s) from your other pending requests)` : '';
        return `Insufficient ${row.leave_type} balance. Available: ${available} day(s)${pendingNote}, requested: ${requested} day(s).`;
    }
    return null;
}

router.post('/api/submit-leave', requireLogin, upload.single('attachment'), async (req, res) => {
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

    const date_entries_json =
        leaveEntries.length > 1
            ? JSON.stringify(
                leaveEntries.map(entry => ({
                    start_date: entry.start_date,
                    end_date: entry.end_date,
                    day_type: entry.day_type,
                    days: entry.duration
                }))
            )
            : null;

    try {
        const balanceError = await checkLeaveBalance(employee_id, leave_type, leaveEntries);
        if (balanceError) {
            return res.status(400).json({ success: false, message: balanceError });
        }
    } catch (balanceErr) {
        console.error('Leave balance check error:', balanceErr);
        return res.status(500).json({ success: false, message: 'Failed to check leave balance.' });
    }

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
        \`Date Entries\`,
        \`Status\`,
        \`Created At\`
    )
    VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        'Pending', NOW()
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
                    attachment_path,
                    date_entries_json
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