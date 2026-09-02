const express = require('express');

const db = require('../config/database');
const upload = require('../middleware/upload');
const { normalizeFilePath, safeVal, safeNum } = require('../utils/helpers');

const router = express.Router();

const handleTravelSubmission = (req, res) => {
    const employee_id   = safeVal(req.body.employee_id || req.body.applicant_id, 50);
    const employee_name = safeVal(req.body.employee_name, 100);
    const department    = safeVal(req.body.department, 100);
    
    let rawCompany = (req.body.company || req.body.company_name || 'focusinsight').toString().toLowerCase().trim();
    const company_name  = rawCompany.includes('fortun') ? 'fortuntech' : 'focusinsight';

    let travelDestination = safeVal(req.body.travel_destination || req.body.destination, 255) || 'N/A';
    let travelMode = safeVal(req.body.travel_mode, 100) || 'Flight';
    if (travelMode === 'others' && req.body.travel_mode_others) {
        travelMode = safeVal(req.body.travel_mode_others, 100);
    }

    const allowance_type = safeVal(req.body.allowance_type, 100) || `Travel to ${travelDestination} (${travelMode})`;
    
    const depDateVal = safeVal(req.body.expected_departure || req.body.expected_departure_date, 20);
    const claim_month = safeVal(req.body.claim_month, 20) || (depDateVal ? depDateVal.substring(0, 7) : new Date().toISOString().substring(0, 7));

    let total_amount = safeNum(req.body.total_amount);
    const venueAddress = safeVal(req.body.venue_address, 0);
    const reason = safeVal(req.body.reason, 0) || `Company: ${company_name} | Venue: ${venueAddress || 'N/A'}`;

    const attachment_path = req.file ? `uploads/${req.file.filename}` : null;

    let assigned_employees = safeVal(req.body.assigned_employees || req.body.employees_json, 0);
    if (assigned_employees && typeof assigned_employees === 'object') {
        assigned_employees = JSON.stringify(assigned_employees);
    }

    const query = `
        INSERT INTO \`travel\` 
        (
            \`employee_id\`, \`employee_name\`, \`assigned_employees\`, \`department\`, \`company_name\`, 
            \`allowance_type\`, \`claim_month\`, \`total_amount\`, \`reason\`, \`supporting_document\`, 
            \`travel_destination\`, \`travel_mode\`, \`departure_destination\`, \`arrival_destination\`, 
            \`expected_departure_date\`, \`expected_arrival_date\`, \`estimated_return_date\`, \`mileage\`, 
            \`required_accommodation\`, \`primary_contact\`, \`contact_phone\`, \`venue_address\`, 
            \`departure_channel\`, \`departure_time\`, \`arrival_time\`, \`airline\`, \`flight_type\`, 
            \`checked_baggage\`, \`flight_cost\`, \`return_channel\`, \`return_departure_time\`, 
            \`return_arrival_time\`, \`return_airline\`, \`return_flight_type\`, \`return_checked_baggage\`, 
            \`return_flight_cost\`, \`hotel_channel\`, \`hotel_name\`, \`hotel_duration\`, \`hotel_nights\`, 
            \`hotel_cost\`, \`status\`, \`created_at\`
        ) 
        VALUES (
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, 
            ?, ?, ?, ?, 
            ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, 
            ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, 
            ?, 'Pending', NOW()
        )
    `;

    const values = [
        employee_id, employee_name, assigned_employees, department, company_name,
        allowance_type, claim_month, total_amount, reason, attachment_path,
        travelDestination, travelMode, safeVal(req.body.departure_destination, 255), safeVal(req.body.arrival_destination, 255),
        safeVal(req.body.expected_departure || req.body.expected_departure_date, 20), safeVal(req.body.expected_arrival || req.body.expected_arrival_date, 20), safeVal(req.body.return_date || req.body.estimated_return_date, 20), safeVal(req.body.mileage, 50),
        safeVal(req.body.accommodation || req.body.required_accommodation, 10) || 'Yes', safeVal(req.body.primary_contact, 150), safeVal(req.body.phone_number || req.body.contact_phone, 50), venueAddress,
        safeVal(req.body.dep_channel, 255), safeVal(req.body.dep_time, 20), safeVal(req.body.dep_arr_time, 20), safeVal(req.body.dep_airline, 100), safeVal(req.body.dep_airline_type, 50) || 'Direct flight',
        safeVal(req.body.dep_baggage, 50) || '25kg', safeNum(req.body.dep_price), safeVal(req.body.ret_channel, 255), safeVal(req.body.ret_time, 20),
        safeVal(req.body.ret_arr_time, 20), safeVal(req.body.ret_airline, 100), safeVal(req.body.ret_airline_type, 50) || 'Direct flight', safeVal(req.body.ret_baggage, 50) || '25kg',
        safeNum(req.body.ret_price), safeVal(req.body.hotel_channel, 255), safeVal(req.body.hotel_name, 150), safeVal(req.body.hotel_duration, 50), safeVal(req.body.hotel_nights, 50),
        safeNum(req.body.hotel_price)
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Travel Submission SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }
        console.log('Successfully saved travel record ID:', result.insertId);
        return res.json({ success: true, message: 'Travel application submitted successfully!' });
    });
}

router.post('/api/submit-disbursement', upload.single('attachment'), (req, res) => {
    const employee_id   = req.body.employee_id;
    const employee_name = req.body.employee_name;
    const department    = req.body.department;
    
    let rawAmount = req.body.total_amount || "0";
    let total_amount = parseFloat(rawAmount.toString().replace(/[^0-9.]/g, '')) || 0.00;

    const attachment_path = req.file ? `uploads/${req.file.filename}` : null;

    const masterQuery = `
        INSERT INTO \`disbursements\` 
        (\`employee_id\`, \`employee_name\`, \`department\`, \`total_amount\`, \`supporting_document\`, \`status\`, \`created_at\`) 
        VALUES (?, ?, ?, ?, ?, 'Pending', NOW())
    `;

    db.query(masterQuery, [employee_id, employee_name, department, total_amount, attachment_path], (err, masterResult) => {
        if (err) {
            console.error('Master SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Failed to save master record: ' + err.message });
        }

        const disbursementId = masterResult.insertId;
        let expenseItems = [];
        try {
            expenseItems = JSON.parse(req.body.items || '[]');
        } catch (parseErr) {
            return res.status(400).json({ success: false, message: 'Invalid format for expense items.' });
        }

        if (expenseItems.length === 0) {
            return res.json({ success: true, message: 'Disbursement saved successfully without itemized lines.' });
        }

        const itemsQuery = `
            INSERT INTO \`disbursement_items\` 
            (\`disbursement_id\`, \`invoice_date\`, \`invoice_no\`, \`supplier_name\`, \`description\`, \`amount\`, \`remark\`) 
            VALUES ?
        `;

        const itemsValues = expenseItems.map(item => [
            disbursementId, 
            item.invoice_date, 
            item.invoice_no, 
            item.supplier_name, 
            item.description, 
            parseFloat(String(item.amount || 0).replace(/[^0-9.]/g, '')) || 0.00, 
            item.remark || ''
        ]);

        db.query(itemsQuery, [itemsValues], (err) => {
            if (err) {
                console.error('Child Table SQL Error:', err);
                return res.status(500).json({ success: false, message: 'Failed to save itemized rows: ' + err.message });
            }
            return res.json({ success: true, message: 'Disbursement form and all rows saved successfully!' });
        });
    });
});

router.post('/api/submit-travel', upload.single('attachment'), handleTravelSubmission);

router.post('/api/submit-allowance', upload.single('attachment'), handleTravelSubmission);

router.post('/api/submit-overtime', upload.none(), (req, res) => {
    const {
        employee_id, employee_name, department, ot_date, period, day_type,
        ot_allowance, ot_rate, start_time, end_time, reason,
        night_allowance_check, meal_allowance_check, total_claim
    } = req.body;

    const emp_id = employee_id || req.body.emp_id;
    const emp_name = employee_name || req.body.emp_name;

    const rawAllowance = ot_allowance || "0";
    const parsedOtAllowance = parseFloat(rawAllowance.toString().replace(/[^0-9.]/g, '')) || 0.00;

    const rawTotalClaim = total_claim || rawAllowance;
    const parsedTotalClaim = parseFloat(rawTotalClaim.toString().replace(/[^0-9.]/g, '')) || 0.00;

    const night_allowance = Number(night_allowance_check) ? 1 : 0;
    const meal_allowance = Number(meal_allowance_check) ? 1 : 0;

    const query = `
        INSERT INTO \`overtime\` 
        (\`employee_id\`, \`employee_name\`, \`department\`, \`ot_date\`, \`start_time\`, \`end_time\`, \`period\`, \`day_type\`, \`ot_allowance\`, \`ot_rate\`, \`night_allowance\`, \`meal_allowance\`, \`reason\`, \`total_claim\`, \`status\`, \`created_at\`) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())
    `;

    db.query(query, [
        emp_id, emp_name, department, ot_date, start_time, end_time,
        period, day_type, parsedOtAllowance, ot_rate, night_allowance,
        meal_allowance, reason, parsedTotalClaim
    ], (err, result) => {
        if (err) {
            console.error('Overtime SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }
        return res.json({ success: true, message: 'Overtime claim submitted successfully!' });
    });
});

router.post('/api/submit-loan', upload.single('attachment'), (req, res) => {
    const {
        employee_id, employee_name, department, loan_type,
        repayment_period, monthly_salary, amount_requested,
        disbursement_method, account_holder, account_number, bank_details
    } = req.body;

    const attachment_path = req.file ? `uploads/${req.file.filename}` : null;

    const query = `
        INSERT INTO \`loans\` 
        (\`employee_id\`, \`employee_name\`, \`department\`, \`loan_type\`, \`repayment_period\`, \`monthly_salary\`, \`amount_requested\`, \`disbursement_method\`, \`account_holder\`, \`account_number\`, \`bank_details\`, \`supporting_document\`, \`status\`, \`created_at\`) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())
    `;

    db.query(query, [
        employee_id, employee_name, department, loan_type,
        repayment_period, monthly_salary, amount_requested,
        disbursement_method, account_holder, account_number,
        bank_details, attachment_path
    ], (err, result) => {
        if (err) {
            console.error('Loan SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }
        return res.json({ success: true, message: 'Loan application submitted successfully!' });
    });
});

router.post('/api/submit-salary-adjustment', upload.single('attachment'), (req, res) => {
    const {
        requested_by, request_date, department,
        employee_id, employee_name, employee_department, position,
        employment_type, employment_date,
        current_basic_salary, adjustment_type, proposed_basic_salary,
        effective_date, justification
    } = req.body;

    if (!employee_id || !proposed_basic_salary || !adjustment_type || !effective_date) {
        return res.status(400).json({ success: false, message: 'Employee ID, Adjustment Type, Proposed Basic Salary, and Effective Date are required.' });
    }

    const currentSalaryNum = safeNum(current_basic_salary);
    const proposedSalaryNum = safeNum(proposed_basic_salary);
    const adjustmentAmount = proposedSalaryNum - currentSalaryNum;
    const adjustmentPercentage = currentSalaryNum > 0 ? (adjustmentAmount / currentSalaryNum) * 100 : 0;

    const attachment_path = req.file ? `uploads/${req.file.filename}` : null;

    const query = `
        INSERT INTO \`salary_adjustments\`
        (\`requested_by\`, \`requested_by_name\`, \`request_date\`, \`department\`,
         \`employee_id\`, \`employee_name\`, \`employee_department\`, \`position\`,
         \`employment_type\`, \`employment_date\`,
         \`current_basic_salary\`, \`adjustment_type\`, \`proposed_basic_salary\`,
         \`adjustment_amount\`, \`adjustment_percentage\`, \`effective_date\`,
         \`justification\`, \`supporting_document\`, \`status\`, \`created_at\`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())
    `;

    db.query(query, [
        safeVal(requested_by, 20),
        safeVal(req.body.requested_by_name, 100),
        safeVal(request_date, 20) || new Date().toISOString().split('T')[0],
        safeVal(department, 100),
        safeVal(employee_id, 20),
        safeVal(employee_name, 100),
        safeVal(employee_department, 100),
        safeVal(position, 100),
        safeVal(employment_type, 50),
        safeVal(employment_date, 50),
        currentSalaryNum,
        safeVal(adjustment_type, 50),
        proposedSalaryNum,
        adjustmentAmount,
        adjustmentPercentage,
        safeVal(effective_date, 20),
        safeVal(justification, 0),
        attachment_path
    ], (err, result) => {
        if (err) {
            console.error('Salary Adjustment SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }
        return res.json({ success: true, message: 'Salary adjustment request submitted successfully!', id: result.insertId });
    });
});

router.post('/api/submit-probation-confirmation', upload.single('attachment'), (req, res) => {
    const {
        requested_by, request_date, department,
        employee_id, employee_name, employee_department, position,
        employment_type, employment_date,
        probation_period, probation_end_date,
        overall_performance, work_performance,
        attendance_punctuality, work_attitude_teamwork,
        recommendation, justification
    } = req.body;

    if (!employee_id || !employee_name || !probation_period || !probation_end_date) {
        return res.status(400).json({ success: false, message: 'Employee ID, Probation Period, and Probation End Date are required.' });
    }
    if (!overall_performance || !work_performance || !attendance_punctuality || !work_attitude_teamwork || !recommendation) {
        return res.status(400).json({ success: false, message: 'Please complete all Probation Assessment fields.' });
    }

    const attachment_path = req.file ? `uploads/${req.file.filename}` : null;

    const query = `
        INSERT INTO \`probation_confirmations\`
        (\`requested_by\`, \`request_date\`, \`department\`,
         \`employee_id\`, \`employee_name\`, \`employee_department\`, \`position\`,
         \`employment_type\`, \`employment_date\`,
         \`probation_period\`, \`probation_end_date\`,
         \`overall_performance\`, \`work_performance\`,
         \`attendance_punctuality\`, \`work_attitude_teamwork\`,
         \`recommendation\`, \`justification\`, \`supporting_document\`,
         \`status\`, \`created_at\`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())
    `;

    db.query(query, [
        safeVal(requested_by, 20),
        safeVal(request_date, 20) || new Date().toISOString().split('T')[0],
        safeVal(department, 100),
        safeVal(employee_id, 20),
        safeVal(employee_name, 100),
        safeVal(employee_department, 100),
        safeVal(position, 100),
        safeVal(employment_type, 50),
        safeVal(employment_date, 50),
        safeVal(probation_period, 50),
        safeVal(probation_end_date, 20),
        safeVal(overall_performance, 50),
        safeVal(work_performance, 50),
        safeVal(attendance_punctuality, 50),
        safeVal(work_attitude_teamwork, 50),
        safeVal(recommendation, 50),
        safeVal(justification, 0),
        attachment_path
    ], (err, result) => {
        if (err) {
            console.error('Probation Confirmation SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }
        return res.json({ success: true, message: 'Probation confirmation form submitted successfully!', id: result.insertId });
    });
});

router.get('/api/request-details', (req, res) => {
    const { id, type } = req.query;

    if (!id || !type) {
        return res.status(400).json({ success: false, message: 'Both Request ID and Type parameters are required.' });
    }

    let query = '';
    const reqType = type.toLowerCase();

    // 1. Join form tables with users table to fetch email & phone number
    if (reqType.includes('leave')) {
        query = `SELECT l.*, u.phone_no, u.email FROM \`leave\` l LEFT JOIN users u ON LOWER(l.\`Employee ID\`) = LOWER(u.user_id COLLATE utf8mb4_general_ci) WHERE l.ID = ? OR l.\`Employee ID\` = ?`;
    } else if (reqType.includes('disbursement')) {
        query = `SELECT d.*, u.phone_no, u.email FROM \`disbursements\` d LEFT JOIN users u ON LOWER(d.employee_id) = LOWER(u.user_id COLLATE utf8mb4_general_ci) WHERE d.id = ?`;
    } else if (reqType.includes('travel')) {
        query = `SELECT t.*, u.phone_no, u.email FROM \`travel\` t LEFT JOIN users u ON LOWER(t.employee_id) = LOWER(u.user_id COLLATE utf8mb4_general_ci) WHERE t.id = ?`;
    } else if (reqType.includes('overtime')) {
        query = `SELECT o.*, u.phone_no, u.email FROM \`overtime\` o LEFT JOIN users u ON LOWER(o.employee_id) = LOWER(u.user_id COLLATE utf8mb4_general_ci) WHERE o.id = ?`;
    } else if (reqType.includes('loan')) {
        query = `SELECT ln.*, u.phone_no, u.email FROM \`loans\` ln LEFT JOIN users u ON LOWER(ln.employee_id) = LOWER(u.user_id COLLATE utf8mb4_general_ci) WHERE ln.id = ?`;
    } else {
        return res.status(400).json({ success: false, message: 'Invalid or unsupported request type.' });
    }

    db.query(query, [id, id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ success: false, message: 'Record not found in database.' });
        }

        const record = { ...results[0] };
        
        // 2. Normalize attachment file path
        const rawDoc = record.supporting_document || record['Supporting Documen'] || record.attachment_path;
        record.supporting_document = normalizeFilePath(rawDoc);

        // 3. Fetch itemized expense rows for Disbursements
        if (reqType.includes('disbursement')) {
            const childQuery = `SELECT * FROM \`disbursement_items\` WHERE disbursement_id = ?`;
            db.query(childQuery, [record.id], (childErr, itemResults) => {
                record.items = itemResults || [];
                return res.json({ success: true, data: record });
            });
        } 
        // 4. Parse assigned employees for Travel requests
        else if (reqType.includes('travel')) {
            let employeeList = [];
            try {
                employeeList = typeof record.assigned_employees === 'string' 
                    ? JSON.parse(record.assigned_employees) 
                    : (record.assigned_employees || []);
            } catch (e) {
                employeeList = [];
            }

            record.employees = employeeList.length > 0 ? employeeList : [{
                employee_id: record.employee_id,
                name: record.employee_name,
                phone_no: record.phone_no || '—',
                email: record.email || '—',
                purpose_of_travel: 'Business trip'
            }];

            return res.json({ success: true, data: record });
        } 
        // 5. Standard return for Leave, Overtime, and Loans
        else {
            return res.json({ success: true, data: record });
        }
    });
});

router.get('/api/my-requests', (req, res) => {
    const req_user_id = req.query.employee_id;

    if (!req_user_id) {
        return res.status(400).json({ success: false, message: 'Employee ID parameter is required.' });
    }

    const roleQuery = 'SELECT position FROM users WHERE LOWER(user_id) = LOWER(?)';
    
    db.query(roleQuery, [req_user_id], (roleErr, roleResults) => {
        let isManagement = false;
        
        if (!roleErr && roleResults.length > 0) {
            const pos = roleResults[0].position.toLowerCase();
            if (pos === 'ceo' || pos === 'manager' || pos === 'supervisor' || pos === 'management') {
                isManagement = true;
            }
        }

        let leaveQuery  = `SELECT * FROM \`leave\``;
        let disQuery    = `SELECT * FROM \`disbursements\``;
        let travelQuery = `SELECT * FROM \`travel\``;
        let otQuery     = `SELECT * FROM \`overtime\``;
        let loanQuery   = `SELECT * FROM \`loans\``;
        let queryParams = [];

        if (!isManagement) {
            leaveQuery  = `SELECT * FROM \`leave\` WHERE LOWER(\`Employee ID\`) = LOWER(?)`;
            disQuery    = `SELECT * FROM \`disbursements\` WHERE LOWER(\`employee_id\`) = LOWER(?)`;
            travelQuery = `SELECT * FROM \`travel\` WHERE LOWER(\`employee_id\`) = LOWER(?)`;
            otQuery     = `SELECT * FROM \`overtime\` WHERE LOWER(\`employee_id\`) = LOWER(?)`;
            loanQuery   = `SELECT * FROM \`loans\` WHERE LOWER(\`employee_id\`) = LOWER(?)`;
            queryParams = [req_user_id];
        }

        db.query(leaveQuery, queryParams, (err, leaveResults) => {
            db.query(disQuery, queryParams, (err, disResults) => {
                db.query(travelQuery, queryParams, (err, travelResults) => {
                    db.query(otQuery, queryParams, (err, otResults) => {
                        db.query(loanQuery, queryParams, (err, loanResults) => {
                            const combinedData = [];

                            (leaveResults || []).forEach(row => {
                                const rawDate = row['Created At'] || row['Start Date'] || '—';
                                let formattedDate = '—';
                                try { formattedDate = new Date(rawDate).toISOString().split('T')[0]; } catch(e) {}

                                combinedData.push({
                                    id: row.id || row.ID || 0,
                                    employee_id: row['Employee ID'] || '—',
                                    employee_name: row['Employee Name'] || '—',
                                    request_type: 'Leave',
                                    details: row['Leave Type'] || 'Leave',
                                    start_date: row['Start Date'] || null,
                                    end_date: row['End Date'] || null,
                                    date_submitted: formattedDate,
                                    created_at: row['Created At'] || row['Start Date'] || null,
                                    last_reminder_sent: row.last_reminder_sent || null,
                                    amount: '—',
                                    status: (row['Status'] || 'Pending').trim()
                                });
                            });

                            (disResults || []).forEach(row => {
                                const rawDate = row['created_at'] || '—';
                                let formattedDate = '—';
                                try { formattedDate = new Date(rawDate).toISOString().split('T')[0]; } catch(e) {}

                                combinedData.push({
                                    id: row.id || 0,
                                    employee_id: row['employee_id'] || '—',
                                    employee_name: row['employee_name'] || '—',
                                    request_type: 'Disbursement',
                                    details: 'Expense Claim',
                                    date_submitted: formattedDate,
                                    created_at: row['created_at'] || null,
                                    last_reminder_sent: row.last_reminder_sent || null,
                                    amount: `RM ${parseFloat(row['total_amount'] || 0).toFixed(2)}`,
                                    status: (row['status'] || 'Pending').trim()
                                });
                            });

                            (travelResults || []).forEach(row => {
                                const rawDate = row['created_at'] || '—';
                                let formattedDate = '—';
                                try { formattedDate = new Date(rawDate).toISOString().split('T')[0]; } catch(e) {}

                                combinedData.push({
                                    id: row.id || 0,
                                    employee_id: row['employee_id'] || '—',
                                    employee_name: row['employee_name'] || '—',
                                    request_type: 'Travel',
                                    details: row['allowance_type'] || 'Travel Claim',
                                    date_submitted: formattedDate,
                                    created_at: row['created_at'] || null,
                                    last_reminder_sent: row.last_reminder_sent || null,
                                    amount: `RM ${parseFloat(row['total_amount'] || 0).toFixed(2)}`,
                                    status: (row['status'] || 'Pending').trim()
                                });
                            });

                            (otResults || []).forEach(row => {
                                const rawDate = row['created_at'] || '—';
                                let formattedDate = '—';
                                try { formattedDate = new Date(rawDate).toISOString().split('T')[0]; } catch(e) {}

                                combinedData.push({
                                    id: row.id || 0,
                                    employee_id: row['employee_id'] || '—',
                                    employee_name: row['employee_name'] || '—',
                                    request_type: 'Overtime',
                                    details: `OT Claim (${row['period'] || '0 hrs'})`,
                                    date_submitted: formattedDate,
                                    created_at: row['created_at'] || null,
                                    last_reminder_sent: row.last_reminder_sent || null,
                                    amount: `RM ${parseFloat(row['total_claim'] || 0).toFixed(2)}`,
                                    status: (row['status'] || 'Pending').trim()
                                });
                            });

                            (loanResults || []).forEach(row => {
                                const rawDate = row['created_at'] || '—';
                                let formattedDate = '—';
                                try { formattedDate = new Date(rawDate).toISOString().split('T')[0]; } catch(e) {}

                                combinedData.push({
                                    id: row.id || 0,
                                    employee_id: row['employee_id'] || '—',
                                    employee_name: row['employee_name'] || '—',
                                    request_type: 'Loan',
                                    details: `${row['loan_type']} Loan (${row['repayment_period']} mos)`,
                                    date_submitted: formattedDate,
                                    created_at: row['created_at'] || null,
                                    last_reminder_sent: row.last_reminder_sent || null,
                                    amount: `RM ${parseFloat(row['amount_requested'] || 0).toFixed(2)}`,
                                    status: (row['status'] || 'Pending').trim()
                                });
                            });

                            combinedData.sort((a, b) => {
                                if (a.date_submitted === '—') return 1;
                                if (b.date_submitted === '—') return -1;
                                return b.date_submitted.localeCompare(a.date_submitted);
                            });

                            return res.json({ success: true, data: combinedData });
                        });
                    });
                });
            });
        });
    });
});

module.exports = router;
