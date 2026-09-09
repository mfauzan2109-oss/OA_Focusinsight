const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ==========================================================================
// API ROUTE: ADD NEW USER (AUTO-SYNCS WITH USERS & DEPARTMENTS TABLE)
// ==========================================================================
router.post('/api/add-user', (req, res) => {
    const {
        fullName, email, icPassport, phoneNo, emergencyContact,
        address, department, position, employmentType, supervisor,
        joinDate, salary, employeeId, employeePassword
    } = req.body;

    if (!employeeId || !fullName || !employeePassword) {
        return res.status(400).json({ success: false, message: 'Employee ID, Full Name, and Password are required.' });
    }

    let cleanDept = (department || 'General').trim();
    if (cleanDept.toLowerCase() === 'sofware') {
        cleanDept = 'Software';
    }

    let cleanPos = (position || 'Employee').trim();
    const parsedSalary = salary ? parseFloat(salary) : 0.00;

    const insertUserQuery = `
        INSERT INTO users 
        (user_id, password, name, email, ic_no, phone_no, emergency_contact, address, department, position, employment_type, manager, join_date, basic_salary, company_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'focusinsight')
    `;

    db.query(insertUserQuery, [
        employeeId.trim(), 
        employeePassword, 
        fullName.trim(), 
        email || null, 
        icPassport || null, 
        phoneNo || null,
        emergencyContact || null, 
        address || null, 
        cleanDept, 
        cleanPos, 
        employmentType || 'Full Time',
        supervisor || null, 
        joinDate || null, 
        parsedSalary 
    ], (err, result) => {
        if (err) {
            console.error('Add User SQL Error:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ success: false, message: `Employee ID '${employeeId}' already exists.` });
            }
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }

        const isManagerRole = /manager|head|hod|ceo|director|supervisor|lead/i.test(cleanPos);

        const checkDeptQuery = `SELECT id, head_of_department FROM departments WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(?))`;

        db.query(checkDeptQuery, [cleanDept], (deptErr, deptResults) => {
            if (deptErr) {
                console.error('[add-user] Error checking departments table:', deptErr);
                return res.json({ success: true, message: 'New employee added, but department lookup failed: ' + deptErr.message, deptSyncOk: false });
            }

            if (deptResults.length > 0) {
                if (isManagerRole) {
                    const updatedHod = fullName.trim();
                    const updateDeptQuery = `UPDATE departments SET head_of_department = ? WHERE id = ?`;
                    db.query(updateDeptQuery, [updatedHod, deptResults[0].id], (upErr, upResult) => {
                        if (upErr) {
                            return res.json({ success: true, message: 'New employee added, but updating the department HOD failed: ' + upErr.message, deptSyncOk: false });
                        }
                        return res.json({ success: true, message: 'New employee added and departments table updated successfully!', deptSyncOk: true, newHod: updatedHod });
                    });
                } else {
                    return res.json({ success: true, message: 'New employee added successfully!', deptSyncOk: true });
                }
            } else {
                const initialHod = isManagerRole ? fullName.trim() : 'Unassigned';
                const insertDeptQuery = `
                    INSERT INTO departments (department_name, head_of_department, date_created, description)
                    VALUES (?, ?, ?, ?)
                `;
                db.query(insertDeptQuery, [cleanDept, initialHod, joinDate || new Date().toISOString().slice(0, 10), null], (inErr, inResult) => {
                    if (inErr) {
                        return res.json({ success: true, message: 'New employee added, but creating the department record failed: ' + inErr.message, deptSyncOk: false });
                    }
                    return res.json({ success: true, message: 'New employee and new department record created successfully!', deptSyncOk: true, newHod: initialHod });
                });
            }
        });
    });
});

// ==========================================================================
// API ROUTE: FETCH ALL USERS
// ==========================================================================
router.get('/api/users', (req, res) => {
    const query = 'SELECT user_id, name, email, phone_no, department, position, employment_type, status FROM users ORDER BY user_id ASC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Fetch Users Error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }
        return res.json({ success: true, data: results });
    });
});

// ==========================================================================
// API ROUTE: BULK EMPLOYEE STATUS (Active / On Leave / Business Trip)
// ==========================================================================
router.get('/api/users-status', (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    // Start with each user's manually-set status (Active/Probation/Suspended/Resigned/Retired).
    const baseStatusQuery = `SELECT user_id, status FROM users`;

    db.query(baseStatusQuery, (baseErr, baseResults) => {
        if (baseErr) {
            console.error('Bulk Status - Base Query Error:', baseErr);
            return res.status(500).json({ success: false, message: 'Database error: ' + baseErr.message });
        }

        const statusMap = {};
        (baseResults || []).forEach(row => {
            if (row.user_id) statusMap[row.user_id.toUpperCase()] = row.status || 'Active';
        });

        const leaveQuery = `
            SELECT DISTINCT \`Employee ID\` as employee_id FROM \`leave\`
            WHERE LOWER(TRIM(Status)) = 'approved'
              AND DATE(\`Start Date\`) <= ?
              AND DATE(\`End Date\`) >= ?
        `;

        db.query(leaveQuery, [today, today], (err, leaveResults) => {
            if (err) {
                console.error('Bulk Status - Leave Query Error:', err);
                return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
            }

            const travelQuery = `
                SELECT DISTINCT employee_id FROM travel
                WHERE LOWER(TRIM(status)) = 'approved'
                  AND DATE(created_at) <= ?
            `;

            db.query(travelQuery, [today], (err2, travelResults) => {
                if (err2) {
                    console.error('Bulk Status - Travel Query Error:', err2);
                    return res.status(500).json({ success: false, message: 'Database error: ' + err2.message });
                }

                // "On Leave" / "Business Trip" are auto-calculated overrides, but only
                // apply on top of employees whose manual status is still "Active" —
                // a Suspended/Resigned/Retired/Probation employee keeps that status
                // even if an old leave/travel record happens to match today's date.
                leaveResults.forEach(row => {
                    const id = row.employee_id ? row.employee_id.toUpperCase() : null;
                    if (id && (statusMap[id] || 'Active') === 'Active') statusMap[id] = 'On Leave';
                });
                travelResults.forEach(row => {
                    const id = row.employee_id ? row.employee_id.toUpperCase() : null;
                    if (id && (statusMap[id] || 'Active') === 'Active') statusMap[id] = 'Business Trip';
                });

                return res.json({ success: true, statusMap });
            });
        });
    });
});

// ==========================================================================
// API ROUTE: UPDATE A USER'S MANUAL STATUS
// (Active / Probation / Suspended / Resigned / Retired)
// ==========================================================================
router.put('/api/users/:id/status', (req, res) => {
    const userId = req.params.id;
    const { status } = req.body;

    const allowedStatuses = ['Active', 'Probation', 'Suspended', 'Resigned', 'Retired'];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`
        });
    }

    const query = `UPDATE users SET status = ? WHERE LOWER(user_id) = LOWER(?)`;
    db.query(query, [status, userId], (err, result) => {
        if (err) {
            console.error('Update User Status Error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        return res.json({ success: true, message: `Status updated to ${status}.` });
    });
});

// ==========================================================================
// API ROUTE: AUTO-GENERATE NEXT UNIQUE EMPLOYEE ID
// ==========================================================================
router.get('/api/next-employee-id', (req, res) => {
    // New staff use the FIS-XXXXXX format (6 random digits), matching the
    // format existing staff IDs were migrated to.
    const query = "SELECT user_id FROM users WHERE user_id LIKE 'FIS-%'";

    db.query(query, (err, results) => {
        if (err) {
            console.error('Fetch Employee IDs Error:', err);
            return res.status(500).json({ success: false, message: 'Database error generating ID.' });
        }

        const existingIds = new Set((results || []).map(r => r.user_id));

        let autoEmployeeId;
        do {
            const randomDigits = Math.floor(100000 + Math.random() * 900000); // 6 digits
            autoEmployeeId = `FIS-${randomDigits}`;
        } while (existingIds.has(autoEmployeeId));

        return res.json({ success: true, nextEmployeeId: autoEmployeeId });
    });
});

module.exports = router;