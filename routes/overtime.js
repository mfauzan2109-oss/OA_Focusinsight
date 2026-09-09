const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');

// ==========================================================================
// API ROUTE: SUBMIT OVERTIME CLAIM
// ==========================================================================
router.post('/api/submit-overtime', upload.none(), (req, res) => {
    const {
        employee_id, employee_name, department, ot_date, period, day_type,
        ot_allowance, ot_rate, start_time, end_time, reason,
        night_allowance_check, meal_allowance_check, total_claim
    } = req.body;

    const emp_id = employee_id || req.body.emp_id;
    const emp_name = employee_name || req.body.emp_name;

    if (!emp_id) {
        return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    }

    // Business rule: OT must be requested before working — reject backdated dates
    const todayStr = new Date().toISOString().split('T')[0];
    if (ot_date && ot_date < todayStr) {
        return res.status(400).json({ success: false, message: 'OT must be requested before working. Backdated dates are not accepted as overtime.' });
    }

    // Business rule: EXEMP (managerial/professional) employees cannot claim OT
    db.query('SELECT position, basic_salary FROM users WHERE LOWER(user_id) = LOWER(?)', [emp_id], (posErr, posResults) => {
        if (posErr) {
            console.error('Overtime Eligibility Check Error:', posErr);
            return res.status(500).json({ success: false, message: 'Database Error: ' + posErr.message });
        }

        const empPosition = (posResults[0] && posResults[0].position) ? posResults[0].position.toLowerCase() : '';
        const isExempt = /manager|head|hod|ceo|director|supervisor|lead|executive|professional/i.test(empPosition);

        if (isExempt) {
            return res.status(403).json({ success: false, message: 'Overtime claims are not applicable to managerial/professional (EXEMP) employees per company policy.' });
        }

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
});

module.exports = router;
