const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');

// ==========================================================================
// API ROUTE: SUBMIT DISBURSEMENT
// ==========================================================================
router.post('/api/submit-disbursement', upload.single('attachment'), (req, res) => {
    const employee_id   = req.body.employee_id;
    const employee_name = req.body.employee_name;
    const department    = req.body.department;
    const proj_name      = req.body.proj_name || '';
    const model_no        = req.body.model_no || '';
    const person_in_charge = req.body.person_in_charge || '';

    let rawAmount = req.body.total_amount || "0";
    let total_amount = parseFloat(rawAmount.toString().replace(/[^0-9.]/g, '')) || 0.00;

    const attachment_path = req.file ? `uploads/${req.file.filename}` : null;

    const masterQuery = `
        INSERT INTO \`disbursements\` 
        (\`employee_id\`, \`employee_name\`, \`department\`, \`proj_name\`, \`model_no\`, \`person_in_charge\`, \`total_amount\`, \`supporting_document\`, \`status\`, \`created_at\`) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())
    `;

    db.query(masterQuery, [employee_id, employee_name, department, proj_name, model_no, person_in_charge, total_amount, attachment_path], (err, masterResult) => {
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

module.exports = router;