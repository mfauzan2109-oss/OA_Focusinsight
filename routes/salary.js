const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');
const { safeVal, safeNum } = require('../utils/helpers');

// ==========================================================================
// API ROUTE: SUBMIT SALARY ADJUSTMENT REQUEST
// ==========================================================================
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

module.exports = router;
