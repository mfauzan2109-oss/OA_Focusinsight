const express = require('express');

const db = require('../config/database');

const router = express.Router();

router.get('/api/profile/:id', (req, res) => {
    const userId = req.params.id;
    // Your `users` table only has `basic_salary` (no separate `salary` column),
    // so we select it directly and alias it to `salary` for the frontend.
    const query = `SELECT user_id, name, email, ic_no, phone_no, emergency_contact, address, department, position, employment_type, manager, join_date, company_name, basic_salary AS salary FROM users WHERE LOWER(user_id) = LOWER(?)`;

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

    // Two different pages PUT to this endpoint: the employee self-service
    // "Edit Profile" page only sends name/email/ic_no/phone_no/emergency_contact
    // /address (department/position/manager/join_date are shown read-only there
    // and never included). The HR employee-edit page sends all of the above.
    // Only overwrite the employment fields when the caller actually included
    // them — otherwise keep whatever is already in the database, instead of
    // silently resetting department to "General" and position to "Employee"
    // every time an employee edits their own contact info.
    const fetchQuery = `SELECT department, position, manager, join_date FROM users WHERE LOWER(user_id) = LOWER(?)`;

    db.query(fetchQuery, [userId], (fetchErr, fetchResults) => {
        if (fetchErr) {
            console.error('Fetch Existing Profile Error:', fetchErr);
            return res.status(500).json({ success: false, message: 'Database error: ' + fetchErr.message });
        }

        if (fetchResults.length === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        const existing = fetchResults[0];

        const cleanDept = department !== undefined ? (department || 'General').trim() : existing.department;
        const cleanPos = position !== undefined ? (position || 'Employee').trim() : existing.position;
        const cleanManager = manager !== undefined ? (manager || null) : existing.manager;
        const cleanJoinDate = join_date !== undefined ? (join_date || null) : existing.join_date;

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

router.post('/api/add-user', (req, res) => {
    const {
        fullName, email, icPassport, phoneNo, emergencyContact,
        address, department, position, employmentType, supervisor,
        joinDate, employeeId, employeePassword
    } = req.body;

    if (!employeeId || !fullName || !employeePassword) {
        return res.status(400).json({ success: false, message: 'Employee ID, Full Name, and Password are required.' });
    }

    let cleanDept = (department || 'General').trim();
    if (cleanDept.toLowerCase() === 'sofware') {
        cleanDept = 'Software';
    }

    let cleanPos = (position || 'Employee').trim();

    const insertUserQuery = `
        INSERT INTO users 
        (user_id, password, name, email, ic_no, phone_no, emergency_contact, address, department, position, employment_type, manager, join_date, company_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'focusinsight')
    `;

    db.query(insertUserQuery, [
        employeeId.trim(), employeePassword, fullName.trim(), email || null, icPassport || null, phoneNo || null,
        emergencyContact || null, address || null, cleanDept, cleanPos, employmentType || 'Full Time',
        supervisor || null, joinDate || null
    ], (err, result) => {
        if (err) {
            console.error('Add User SQL Error:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ success: false, message: `Employee ID '${employeeId}' already exists.` });
            }
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }

        // Detect if this new hire holds a leadership-type position
        const isManagerRole = /manager|head|hod|ceo|director|supervisor|lead/i.test(cleanPos);

        console.log(`[add-user] New hire: ${fullName.trim()} | Position: "${cleanPos}" | isManagerRole: ${isManagerRole} | Department: "${cleanDept}"`);

        const checkDeptQuery = `SELECT id, head_of_department FROM departments WHERE LOWER(TRIM(department_name)) = LOWER(TRIM(?))`;

        db.query(checkDeptQuery, [cleanDept], (deptErr, deptResults) => {
            if (deptErr) {
                console.error('[add-user] Error checking departments table:', deptErr);
                return res.json({ success: true, message: 'New employee added, but department lookup failed: ' + deptErr.message, deptSyncOk: false });
            }

            console.log(`[add-user] Departments table match for "${cleanDept}":`, deptResults.length > 0 ? deptResults[0] : 'NOT FOUND');

            if (deptResults.length > 0) {
                // Department already exists
                if (isManagerRole) {
                    // The newly assigned HOD REPLACES whoever was HOD before
                    const updatedHod = fullName.trim();

                    const updateDeptQuery = `UPDATE departments SET head_of_department = ? WHERE id = ?`;
                    db.query(updateDeptQuery, [updatedHod, deptResults[0].id], (upErr, upResult) => {
                        if (upErr) {
                            console.error('[add-user] Error updating departments table HOD:', upErr);
                            return res.json({ success: true, message: 'New employee added, but updating the department HOD failed: ' + upErr.message, deptSyncOk: false });
                        }
                        console.log(`[add-user] HOD updated for department id ${deptResults[0].id}. Rows affected: ${upResult.affectedRows}`);
                        return res.json({ success: true, message: 'New employee added and departments table updated successfully!', deptSyncOk: true, newHod: updatedHod });
                    });
                } else {
                    return res.json({ success: true, message: 'New employee added successfully!', deptSyncOk: true });
                }
            } else {
                // Department doesn't exist yet — create it
                const initialHod = isManagerRole ? fullName.trim() : 'Unassigned';
                const insertDeptQuery = `
                    INSERT INTO departments (department_name, head_of_department, date_created, description)
                    VALUES (?, ?, ?, ?)
                `;
                db.query(insertDeptQuery, [cleanDept, initialHod, joinDate || new Date().toISOString().slice(0, 10), null], (inErr, inResult) => {
                    if (inErr) {
                        console.error('[add-user] Error inserting new department record:', inErr);
                        return res.json({ success: true, message: 'New employee added, but creating the department record failed: ' + inErr.message, deptSyncOk: false });
                    }
                    console.log(`[add-user] New department "${cleanDept}" created with HOD "${initialHod}", insertId: ${inResult.insertId}`);
                    return res.json({ success: true, message: 'New employee and new department record created successfully!', deptSyncOk: true, newHod: initialHod });
                });
            }
        });
    });
});

router.get('/api/users', (req, res) => {
    const query = 'SELECT user_id, name, email, phone_no, department, position, employment_type FROM users ORDER BY user_id ASC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Fetch Users Error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }
        return res.json({ success: true, data: results });
    });
});

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