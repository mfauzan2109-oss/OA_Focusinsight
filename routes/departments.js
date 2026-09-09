const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ==========================================================================
// API ROUTE: DYNAMIC DEPARTMENTS & MANAGERS/CEOS FROM USERS TABLE
// ==========================================================================
router.get('/api/departments', (req, res) => {
    const usersSql = `SELECT user_id, name, department, position, manager FROM users`;
    const deptsSql = `SELECT department_name, head_of_department FROM departments`;

    db.query(usersSql, (err, users) => {
        if (err) {
            console.error('Fetch Departments Error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }

        db.query(deptsSql, (err2, manualDepts) => {
            if (err2) {
                console.error('Fetch departments table Error:', err2);
                return res.status(500).json({ success: false, message: 'Database error: ' + err2.message });
            }

            const deptMap = {};

            const isLeadership = (position) => {
                const pos = (position || '').toLowerCase();
                return pos.includes('ceo') || pos.includes('manager') || pos.includes('head') ||
                       pos.includes('director') || pos.includes('hod') || pos.includes('supervisor') || pos.includes('lead');
            };

            const globalManagers = (users || []).filter(u => isLeadership(u.position));

            (manualDepts || []).forEach(d => {
                let deptName = (d.department_name || '').trim();
                if (!deptName) return;

                const deptKey = deptName.toLowerCase();
                const displayName = deptName.charAt(0).toUpperCase() + deptName.slice(1).toLowerCase();

                if (!deptMap[deptKey]) {
                    deptMap[deptKey] = {
                        department: displayName,
                        headcount: 0,
                        members: [],
                        manualHod: (d.head_of_department || '').trim() || null
                    };
                }
            });

            (users || []).forEach(u => {
                let deptName = (u.department || '').trim();
                if (!deptName) return;

                if (deptName.toLowerCase() === 'sofware') deptName = 'Software';

                const deptKey = deptName.toLowerCase();
                const displayName = deptName.charAt(0).toUpperCase() + deptName.slice(1).toLowerCase();

                if (!deptMap[deptKey]) {
                    deptMap[deptKey] = {
                        department: displayName,
                        headcount: 0,
                        members: [],
                        manualHod: null
                    };
                }

                deptMap[deptKey].headcount += 1;
                deptMap[deptKey].members.push(u);
            });

            const resultData = Object.keys(deptMap).map(deptKey => {
                const item = deptMap[deptKey];

                const deptManagers = item.members.filter(m => isLeadership(m.position));

                let hodText = 'Unassigned';

                if (deptManagers.length > 0) {
                    hodText = deptManagers.map(m => m.name).join(', ');
                } else {
                    const legacy = [...new Set(item.members.map(m => m.manager).filter(m => m && m.trim()))];
                    if (legacy.length > 0) {
                        hodText = legacy.join(', ');
                    } else if (item.manualHod) {
                        hodText = item.manualHod;
                    } else if (globalManagers.length > 0) {
                        hodText = globalManagers.map(m => m.name).join(', ');
                    }
                }

                return {
                    department: item.department,
                    headcount: item.headcount,
                    hod: hodText
                };
            });

            resultData.sort((a, b) => a.department.localeCompare(b.department));

            return res.json({ success: true, data: resultData });
        });
    });
});

// ==========================================================================
// API ROUTE: CREATE NEW DEPARTMENT (from Add Department page)
// ==========================================================================
router.post('/api/departments', (req, res) => {
    const { department_name, head_of_department, date_created, description } = req.body;

    if (!department_name || !department_name.trim()) {
        return res.status(400).json({ success: false, message: 'Department name is required.' });
    }

    const deptName = department_name.trim();

    const checkQuery = `SELECT id FROM departments WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(?))`;
    db.query(checkQuery, [deptName], (err, existing) => {
        if (err) {
            console.error('Check Department Error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }

        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'A department with this name already exists.' });
        }

        const insertQuery = `
            INSERT INTO departments (department_name, head_of_department, date_created, description)
            VALUES (?, ?, ?, ?)
        `;
        const values = [
            deptName,
            head_of_department ? head_of_department.trim() : null,
            date_created || new Date().toISOString().slice(0, 10),
            description ? description.trim() : null
        ];

        db.query(insertQuery, values, (err2, result) => {
            if (err2) {
                console.error('Insert Department Error:', err2);
                return res.status(500).json({ success: false, message: 'Database error: ' + err2.message });
            }
            return res.json({ success: true, message: 'Department created successfully.', id: result.insertId });
        });
    });
});

// ==========================================================================
// API ROUTE: FETCH SPECIFIC DEPARTMENT DETAILS & EMPLOYEE LIST FROM USERS
// ==========================================================================
router.get('/api/departments/details/:name', (req, res) => {
    const rawDeptName = req.params.name;

    if (!rawDeptName) {
        return res.status(400).json({ success: false, message: 'Department name is required.' });
    }

    const deptName = rawDeptName.trim().charAt(0).toUpperCase() + rawDeptName.trim().slice(1).toLowerCase();

    const empQuery = `
        SELECT user_id, name, position, join_date, email, phone_no, manager 
        FROM users 
        WHERE LOWER(TRIM(department)) = LOWER(TRIM(?))
        ORDER BY 
            CASE 
                WHEN LOWER(position) LIKE '%ceo%' THEN 1
                WHEN LOWER(position) LIKE '%head%' OR LOWER(position) LIKE '%hod%' THEN 2
                WHEN LOWER(position) LIKE '%manager%' THEN 3
                WHEN LOWER(position) LIKE '%supervisor%' THEN 4
                ELSE 5
            END ASC, user_id ASC
    `;

    const deptQuery = `SELECT department_name, head_of_department, date_created, description FROM departments WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(?))`;

    db.query(empQuery, [deptName], (err, results) => {
        if (err) {
            console.error('Fetch Department Details Error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }

        const employees = results || [];

        db.query(deptQuery, [deptName], (deptErr, deptResults) => {
            if (deptErr) {
                console.error('Fetch departments table Error:', deptErr);
            }

            const deptRecord = (deptResults && deptResults.length > 0) ? deptResults[0] : null;

            // HOD: prefer the value stored in the departments table (editable
            // by the user); fall back to computing it live from employees.
            let hodName = 'Unassigned';
            if (deptRecord && deptRecord.head_of_department && deptRecord.head_of_department.trim()) {
                hodName = deptRecord.head_of_department.trim();
            } else {
                const managers = employees.filter(e => {
                    const pos = (e.position || '').toLowerCase();
                    return pos.includes('ceo') || pos.includes('head') || pos.includes('manager') || pos.includes('director') || pos.includes('supervisor');
                });
                if (managers.length > 0) {
                    hodName = managers.map(m => m.name).join(', ');
                } else {
                    const legacyManagers = [...new Set(employees.map(e => e.manager).filter(m => m && m.trim()))];
                    if (legacyManagers.length > 0) hodName = legacyManagers.join(', ');
                }
            }

            // Date Created: prefer the stored value; fall back to earliest join_date
            let dateCreatedDisplay = '—';
            let dateCreatedRaw = '';
            if (deptRecord && deptRecord.date_created) {
                const dc = new Date(deptRecord.date_created);
                if (!isNaN(dc.getTime())) {
                    dateCreatedRaw = dc.toISOString().split('T')[0];
                    const day = String(dc.getDate()).padStart(2, '0');
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    dateCreatedDisplay = `${day} - ${monthNames[dc.getMonth()]} - ${dc.getFullYear()}`;
                }
            } else if (employees.length > 0) {
                const dates = employees
                    .map(e => e.join_date ? new Date(e.join_date) : null)
                    .filter(d => d && !isNaN(d.getTime()));
                if (dates.length > 0) {
                    const minDate = new Date(Math.min(...dates));
                    dateCreatedRaw = minDate.toISOString().split('T')[0];
                    const day = String(minDate.getDate()).padStart(2, '0');
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    dateCreatedDisplay = `${day} - ${monthNames[minDate.getMonth()]} - ${minDate.getFullYear()}`;
                }
            }

            return res.json({
                success: true,
                department: deptName,
                hod: hodName,
                description: deptRecord ? (deptRecord.description || '') : '',
                date_created: dateCreatedDisplay,
                date_created_raw: dateCreatedRaw,
                headcount: employees.length,
                employees: employees
            });
        });
    });
});

// ==========================================================================
// API ROUTE: UPDATE DEPARTMENT NAME ACROSS USERS TABLE
// ==========================================================================
router.put('/api/departments/details/:name', (req, res) => {
    const oldDeptName = req.params.name;
    const { newDeptName, head_of_department, description } = req.body;

    if (!oldDeptName || !newDeptName) {
        return res.status(400).json({ success: false, message: 'Both old and new department names are required.' });
    }

    const cleanOldName = oldDeptName.trim();
    const cleanNewName = newDeptName.trim();
    const isRenaming = cleanOldName.toLowerCase() !== cleanNewName.toLowerCase();

    // Step 1: If renamed, cascade the new name to every employee currently in this department
    const renameEmployeesQuery = isRenaming
        ? `UPDATE users SET department = ? WHERE LOWER(TRIM(department)) = LOWER(TRIM(?))`
        : null;

    const runRename = (cb) => {
        if (!isRenaming) return cb(null);
        db.query(renameEmployeesQuery, [cleanNewName, cleanOldName], (err) => cb(err));
    };

    runRename((renameErr) => {
        if (renameErr) {
            console.error('Update Department (users) Error:', renameErr);
            return res.status(500).json({ success: false, message: 'Failed to rename department: ' + renameErr.message });
        }

        // Step 2: Check if a row already exists in the departments table for the OLD name
        const checkQuery = `SELECT id FROM departments WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(?))`;
        db.query(checkQuery, [cleanOldName], (checkErr, checkResults) => {
            if (checkErr) {
                console.error('Check departments table Error:', checkErr);
                return res.status(500).json({ success: false, message: 'Database error: ' + checkErr.message });
            }

            const hodValue = head_of_department ? head_of_department.trim() : null;
            const descValue = description ? description.trim() : null;

            if (checkResults.length > 0) {
                // Update the existing row (name, HOD, description)
                const updateQuery = `UPDATE departments SET department_name = ?, head_of_department = ?, description = ? WHERE id = ?`;
                db.query(updateQuery, [cleanNewName, hodValue, descValue, checkResults[0].id], (upErr) => {
                    if (upErr) {
                        console.error('Update departments table Error:', upErr);
                        return res.status(500).json({ success: false, message: 'Failed to update department record: ' + upErr.message });
                    }
                    return res.json({ success: true, message: 'Department updated successfully!' });
                });
            } else {
                // No row existed yet for this department — create one now
                const insertQuery = `INSERT INTO departments (department_name, head_of_department, date_created, description) VALUES (?, ?, ?, ?)`;
                db.query(insertQuery, [cleanNewName, hodValue, new Date().toISOString().slice(0, 10), descValue], (inErr) => {
                    if (inErr) {
                        console.error('Insert departments table Error:', inErr);
                        return res.status(500).json({ success: false, message: 'Failed to create department record: ' + inErr.message });
                    }
                    return res.json({ success: true, message: 'Department updated successfully!' });
                });
            }
        });
    });
});

// ==========================================================================
// API ROUTE: REASSIGN EMPLOYEE TO DEPARTMENT IN USERS TABLE
// ==========================================================================
router.post('/api/departments/assign-employee', (req, res) => {
    const { user_id, department } = req.body;

    if (!user_id || !department) {
        return res.status(400).json({ success: false, message: 'User ID and Department name are required.' });
    }

    const cleanDept = department.trim();
    const query = `UPDATE users SET department = ? WHERE LOWER(TRIM(user_id)) = LOWER(TRIM(?))`;

    db.query(query, [cleanDept, user_id.trim()], (err, result) => {
        if (err) {
            console.error('Reassign Employee Error:', err);
            return res.status(500).json({ success: false, message: 'Failed to assign employee: ' + err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: `Employee ID '${user_id}' not found.` });
        }

        // Check if this employee holds a leadership position — if so,
        // they REPLACE whoever was HOD of their new department.
        const getEmployeeQuery = `SELECT name, position FROM users WHERE LOWER(TRIM(user_id)) = LOWER(TRIM(?))`;
        db.query(getEmployeeQuery, [user_id.trim()], (empErr, empResults) => {
            if (empErr || empResults.length === 0) {
                console.error('[assign-employee] Could not fetch employee for HOD sync:', empErr);
                return res.json({ success: true, message: `Employee '${user_id}' assigned to ${cleanDept} successfully!`, deptSyncOk: false });
            }

            const employee = empResults[0];
            const isManagerRole = /manager|head|hod|ceo|director|supervisor|lead/i.test(employee.position || '');

            if (!isManagerRole) {
                return res.json({ success: true, message: `Employee '${user_id}' assigned to ${cleanDept} successfully!`, deptSyncOk: true });
            }

            const checkDeptQuery = `SELECT id FROM departments WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(?))`;
            db.query(checkDeptQuery, [cleanDept], (deptErr, deptResults) => {
                if (deptErr) {
                    console.error('[assign-employee] Error checking departments table:', deptErr);
                    return res.json({ success: true, message: `Employee '${user_id}' assigned, but department HOD sync failed.`, deptSyncOk: false });
                }

                if (deptResults.length > 0) {
                    // Replace the existing HOD with this employee
                    const updateDeptQuery = `UPDATE departments SET head_of_department = ? WHERE id = ?`;
                    db.query(updateDeptQuery, [employee.name.trim(), deptResults[0].id], (upErr) => {
                        if (upErr) console.error('[assign-employee] Error updating HOD:', upErr);
                        return res.json({
                            success: true,
                            message: `Employee '${user_id}' assigned to ${cleanDept} and set as new HOD successfully!`,
                            deptSyncOk: !upErr,
                            newHod: employee.name.trim()
                        });
                    });
                } else {
                    // Department row doesn't exist yet — create it with this employee as HOD
                    const insertDeptQuery = `
                        INSERT INTO departments (department_name, head_of_department, date_created, description)
                        VALUES (?, ?, ?, ?)
                    `;
                    db.query(insertDeptQuery, [cleanDept, employee.name.trim(), new Date().toISOString().slice(0, 10), null], (inErr) => {
                        if (inErr) console.error('[assign-employee] Error creating department record:', inErr);
                        return res.json({
                            success: true,
                            message: `Employee '${user_id}' assigned to ${cleanDept} and set as new HOD successfully!`,
                            deptSyncOk: !inErr,
                            newHod: employee.name.trim()
                        });
                    });
                }
            });
        });
    });
});

module.exports = router;
