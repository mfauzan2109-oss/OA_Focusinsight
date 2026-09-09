const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');
const { safeVal, safeNum } = require('../utils/helpers');

// ==========================================================================
// API ROUTE: SUBMIT PROBATION CONFIRMATION FORM
// ==========================================================================
// Note: this form has no file/attachment input, but the browser still sends
// it as multipart/form-data (since the frontend uses FormData + fetch), so
// we still need multer here — upload.none() parses text-only multipart data.
router.post('/api/submit-probation-confirmation', upload.none(), (req, res) => {
    const {
        requested_by, request_date, department,
        employee_id, employee_name, employee_department, position,
        employment_type, employment_date,
        probation_period, probation_end_date,
        assessment_job_knowledge, assessment_quality_of_work, assessment_work_productivity,
        assessment_communication_skills, assessment_teamwork_collaboration,
        assessment_problem_solving_initiative, assessment_attendance_punctuality,
        assessment_adaptability_learning, assessment_responsibility_attitude,
        assessment_compliance_policies,
        total_points, passing_points,
        overall_recommendation, proposed_confirmation_date, extended_probation_period,
        performance_summary
    } = req.body;

    if (!employee_id || !employee_name || !probation_period || !probation_end_date) {
        return res.status(400).json({ success: false, message: 'Employee ID, Probation Period, and Probation End Date are required.' });
    }

    const assessmentFields = {
        assessment_job_knowledge, assessment_quality_of_work, assessment_work_productivity,
        assessment_communication_skills, assessment_teamwork_collaboration,
        assessment_problem_solving_initiative, assessment_attendance_punctuality,
        assessment_adaptability_learning, assessment_responsibility_attitude,
        assessment_compliance_policies
    };
    const missingAssessment = Object.values(assessmentFields).some(v => v === undefined || v === null || v === '');
    if (missingAssessment) {
        return res.status(400).json({ success: false, message: 'Please complete every item in the Probation Assessment section.' });
    }

    if (!overall_recommendation) {
        return res.status(400).json({ success: false, message: 'Overall Recommendation is required.' });
    }
    if (overall_recommendation === 'Confirm Employment' && !proposed_confirmation_date) {
        return res.status(400).json({ success: false, message: 'Proposed Confirmation Date is required when recommending Confirm Employment.' });
    }
    if (overall_recommendation === 'Extend Probation' && !extended_probation_period) {
        return res.status(400).json({ success: false, message: 'Extended Probation Period is required when recommending Extend Probation.' });
    }
    if (!performance_summary) {
        return res.status(400).json({ success: false, message: 'Performance Summary is required.' });
    }

    const query = `
        INSERT INTO \`probation_confirmations\`
        (\`requested_by\`, \`request_date\`, \`department\`,
         \`employee_id\`, \`employee_name\`, \`employee_department\`, \`position\`,
         \`employment_type\`, \`employment_date\`,
         \`probation_period\`, \`probation_end_date\`,
         \`assessment_job_knowledge\`, \`assessment_quality_of_work\`, \`assessment_work_productivity\`,
         \`assessment_communication_skills\`, \`assessment_teamwork_collaboration\`,
         \`assessment_problem_solving_initiative\`, \`assessment_attendance_punctuality\`,
         \`assessment_adaptability_learning\`, \`assessment_responsibility_attitude\`,
         \`assessment_compliance_policies\`,
         \`total_points\`, \`passing_points\`,
         \`overall_recommendation\`, \`proposed_confirmation_date\`, \`extended_probation_period\`,
         \`performance_summary\`, \`status\`, \`created_at\`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())
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
        safeNum(assessment_job_knowledge),
        safeNum(assessment_quality_of_work),
        safeNum(assessment_work_productivity),
        safeNum(assessment_communication_skills),
        safeNum(assessment_teamwork_collaboration),
        safeNum(assessment_problem_solving_initiative),
        safeNum(assessment_attendance_punctuality),
        safeNum(assessment_adaptability_learning),
        safeNum(assessment_responsibility_attitude),
        safeNum(assessment_compliance_policies),
        safeNum(total_points),
        safeNum(passing_points) || 40,
        safeVal(overall_recommendation, 50),
        safeVal(proposed_confirmation_date, 20) || null,
        safeVal(extended_probation_period, 50) || null,
        safeVal(performance_summary, 0)
    ], (err, result) => {
        if (err) {
            console.error('Probation Confirmation SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }
        return res.json({ success: true, message: 'Probation confirmation form submitted successfully!', id: result.insertId });
    });
});

module.exports = router;