const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');

// ==========================================================================
// API ROUTE: SUBMIT LOAN APPLICATION
// ==========================================================================
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

module.exports = router;
