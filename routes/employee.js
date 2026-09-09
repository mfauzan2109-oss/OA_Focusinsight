const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');
const { getAnnualEntitlement, getSickEntitlement } = require('../utils/helpers');

// ==========================================================================
// API ROUTES: USER LEAVE INFO & BALANCES
// ==========================================================================
router.get('/api/user-leave-info', (req, res) => {
    const userId = req.query.employee_id;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    }

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

router.get('/api/profile/:id', (req, res) => {
    const userId = req.params.id;
    // Your `users` table only has `basic_salary` (no separate `salary` column),
    // so we select it directly and alias it to `salary` for the frontend.
    const query = `SELECT user_id, name, email, profile_picture, ic_no, phone_no, emergency_contact, address, department, position, employment_type, manager, join_date, company_name, basic_salary AS salary FROM users WHERE LOWER(user_id) = LOWER(?)`;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Fetch Profile Error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }
        if (results.length > 0) {
            const row = results[0];
            // Format salary as clean 2-decimal string for the frontend
            if (row.salary !== null && row.salary !== undefined) {
                row.salary = parseFloat(row.salary).toFixed(2);
            }
            return res.json({ success: true, data: row });
        } else {
            return res.status(404).json({ success: false, message: 'User profile not found.' });
        }
    });
});

router.get('/api/user-status/:id', (req, res) => {
    const userId = req.params.id;
    const today = new Date().toISOString().split('T')[0];

    const leaveQuery = `
        SELECT * FROM \`leave\` 
        WHERE LOWER(\`Employee ID\`) = LOWER(?) 
          AND LOWER(TRIM(Status)) = 'approved' 
          AND DATE(\`Start Date\`) <= ? 
          AND DATE(\`End Date\`) >= ?
    `;

    db.query(leaveQuery, [userId, today, today], (err, leaveResults) => {
        if (err) {
            console.error('Check Leave Status Error:', err);
            return res.status(500).json({ success: false, message: 'Database error.' });
        }

        if (leaveResults.length > 0) {
            return res.json({ success: true, currentStatus: 'On Leave' });
        }

        const travelQuery = `
            SELECT * FROM \`travel\` 
            WHERE LOWER(\`employee_id\`) = LOWER(?) 
              AND LOWER(TRIM(status)) = 'approved' 
              AND DATE(\`created_at\`) <= ?
        `;

        db.query(travelQuery, [userId, today], (err2, travelResults) => {
            if (err2) {
                console.error('Check Travel Status Error:', err2);
                return res.status(500).json({ success: false, message: 'Database error.' });
            }

            if (travelResults.length > 0) {
                return res.json({ success: true, currentStatus: 'Business Trip' });
            }

            return res.json({ success: true, currentStatus: null });
        });
    });
});

router.put('/api/profile/:id', (req, res) => {
    const userId = req.params.id;
    const { 
        name, email, ic_no, phone_no, emergency_contact, 
        address, department, position, manager, join_date 
    } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is missing.' });
    }

    // Fetch the current row first so fields the frontend didn't send
    // (e.g. department/position, which employees usually can't self-edit)
    // are preserved instead of being overwritten with a generic default.
    const currentQuery = `SELECT department, position, manager, join_date FROM users WHERE LOWER(user_id) = LOWER(?)`;

    db.query(currentQuery, [userId], (fetchErr, currentResults) => {
        if (fetchErr) {
            console.error('Fetch Current Profile Error:', fetchErr);
            return res.status(500).json({ success: false, message: 'Database error: ' + fetchErr.message });
        }

        const existing = currentResults[0] || {};

        const cleanDept = (department !== undefined && department !== null && department !== ''
            ? department
            : (existing.department || 'General')).trim();
        const cleanPos = (position !== undefined && position !== null && position !== ''
            ? position
            : (existing.position || 'Employee')).trim();
        const cleanManager = (manager !== undefined && manager !== null && manager !== '')
            ? manager
            : (existing.manager || null);
        const cleanJoinDate = (join_date !== undefined && join_date !== null && join_date !== '')
            ? join_date
            : (existing.join_date || null);

        const query = `
            UPDATE users 
            SET name = ?, email = ?, ic_no = ?, phone_no = ?, emergency_contact = ?, 
                address = ?, department = ?, position = ?, manager = ?, join_date = ? 
            WHERE LOWER(user_id) = LOWER(?)
        `;

        db.query(query, [
            name || '', 
            email || '', 
            ic_no || '', 
            phone_no || '', 
            emergency_contact || '', 
            address || '', 
            cleanDept,
            cleanPos,
            cleanManager,
            cleanJoinDate,
            userId
        ], (err, result) => {
            if (err) {
                console.error('Update Profile Error:', err);
                return res.status(500).json({ success: false, message: 'Failed to update profile: ' + err.message });
            }

            // Sync the departments table's head_of_department whenever a position
            // edit turns this employee into (or out of) a leadership role.
            const isManagerRole = /manager|head|hod|ceo|director|supervisor|lead/i.test(cleanPos);

            if (!isManagerRole || !name) {
                return res.json({ success: true, message: 'Employee profile updated successfully!' });
            }

            const checkDeptQuery = `SELECT id FROM departments WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(?))`;
            db.query(checkDeptQuery, [cleanDept], (deptErr, deptResults) => {
                if (deptErr) {
                    console.error('[profile-update] Error checking departments table:', deptErr);
                    return res.json({ success: true, message: 'Employee profile updated, but department HOD sync failed.', deptSyncOk: false });
                }

                if (deptResults.length > 0) {
                    const updateDeptQuery = `UPDATE departments SET head_of_department = ? WHERE id = ?`;
                    db.query(updateDeptQuery, [name.trim(), deptResults[0].id], (upErr) => {
                        if (upErr) console.error('[profile-update] Error updating HOD:', upErr);
                        return res.json({
                            success: true,
                            message: 'Employee profile updated and set as new HOD successfully!',
                            deptSyncOk: !upErr,
                            newHod: name.trim()
                        });
                    });
                } else {
                    const insertDeptQuery = `
                        INSERT INTO departments (department_name, head_of_department, date_created, description)
                        VALUES (?, ?, ?, ?)
                    `;
                    db.query(insertDeptQuery, [cleanDept, name.trim(), new Date().toISOString().slice(0, 10), null], (inErr) => {
                        if (inErr) console.error('[profile-update] Error creating department record:', inErr);
                        return res.json({
                            success: true,
                            message: 'Employee profile updated and set as new HOD successfully!',
                            deptSyncOk: !inErr,
                            newHod: name.trim()
                        });
                    });
                }
            });
        });
    });
});

// ==========================================================================
// API ROUTE: UPLOAD / UPDATE PROFILE PICTURE
// ==========================================================================
router.post('/api/profile/:id/picture', upload.single('profile_picture'), (req, res) => {
    const userId = req.params.id;

    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image file was uploaded.' });
    }

    const picturePath = `uploads/${req.file.filename}`;
    const query = `UPDATE users SET profile_picture = ? WHERE LOWER(user_id) = LOWER(?)`;

    db.query(query, [picturePath, userId], (err, result) => {
        if (err) {
            console.error('Upload Profile Picture Error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        return res.json({ success: true, message: 'Profile picture updated successfully!', profile_picture: picturePath });
    });
});

module.exports = router;