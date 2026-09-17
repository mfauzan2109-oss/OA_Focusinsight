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
// NOTE ON ROUTING TO MANAGER/HOD:
// The `department` column is what the approval-queue lookup is assumed to
// filter pending items against (matching the logged-in manager's own
// session department). For every OTHER form type that column holds the
// requester's own department, but for this form the requester is HR, and
// the request needs to land with the Manager/HOD of the EMPLOYEE's
// department instead. So we deliberately overwrite `department` with the
// employee's department here — HR's own requesting department is not kept
// on this row (your table has no separate column for it).
// If /api/approval-queue filters on something other than `department`,
// this will need to be adjusted to match.
router.post('/api/submit-probation-confirmation', upload.none(), (req, res) => {
    const {
        requested_by, request_date,
        employee_id, employee_name, employee_department, position,
        employment_type, employment_date,
        probation_period, probation_end_date,
        reason_remarks
    } = req.body;

    // Only Request Information, Employee Information, and Reason/Remarks are
    // HR's responsibility on this form. The Probation Assessment,
    // Confirmation Recommendation, and Performance Summary sections are
    // Manager/HOD-only and are filled in later from the Approval Queue, so
    // they are intentionally NOT required (or even accepted) here.
    if (!employee_id || !employee_name || !probation_period || !probation_end_date) {
        return res.status(400).json({ success: false, message: 'Employee ID, Probation Period, and Probation End Date are required.' });
    }
    if (!employee_department) {
        return res.status(400).json({ success: false, message: 'Employee Department could not be determined. Please re-select a valid Employee ID.' });
    }

    const query = `
        INSERT INTO \`probation_confirmations_hr\`
        (\`requested_by\`, \`request_date\`, \`department\`,
         \`employee_id\`, \`employee_name\`, \`employee_department\`, \`position\`,
         \`employment_type\`, \`employment_date\`,
         \`probation_period\`, \`probation_end_date\`,
         \`reason_remarks\`,
         \`passing_points\`, \`status\`, \`created_at\`)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())
    `;

    db.query(query, [
        safeVal(requested_by, 50),
        safeVal(request_date, 20) || new Date().toISOString().split('T')[0],
        safeVal(employee_department, 100),   // routing department = employee's department
        safeVal(employee_id, 50),
        safeVal(employee_name, 150),
        safeVal(employee_department, 100),
        safeVal(position, 150),
        safeVal(employment_type, 50),
        safeVal(employment_date, 50),
        safeVal(probation_period, 50),
        safeVal(probation_end_date, 20),
        safeVal(reason_remarks, 0),
        40
    ], (err, result) => {
        if (err) {
            console.error('Probation Confirmation SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }
        return res.json({ success: true, message: 'Probation confirmation form submitted successfully!', id: result.insertId });
    });
});

// ==========================================================================
// API ROUTE: MANAGER/HOD SUBMITS ASSESSMENT + APPROVAL DECISION
// ==========================================================================
// Called from the Approval Queue. This is the ONLY place the Probation
// Assessment, Confirmation Recommendation, and Performance Summary fields
// get written. It validates them the same way the old single-form route
// used to, computes the total score server-side (never trust the client
// total), and records the decision in one atomic update.
router.put('/api/probation-confirmation/:id/decision', (req, res) => {
    const { id } = req.params;
    const {
        assessment_job_knowledge, assessment_quality_of_work, assessment_work_productivity,
        assessment_communication_skills, assessment_teamwork_collaboration,
        assessment_problem_solving_initiative, assessment_attendance_punctuality,
        assessment_adaptability_learning, assessment_responsibility_attitude,
        assessment_compliance_policies,
        overall_recommendation, proposed_confirmation_date, extended_probation_period,
        performance_summary,
        status, comment,
        decided_by
    } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, message: 'Missing probation confirmation ID.' });
    }
    if (!status || !['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'A valid decision status (Approved / Rejected) is required.' });
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

    const total_points = Object.values(assessmentFields).reduce((sum, v) => sum + Number(v || 0), 0);

    const query = `
        UPDATE \`probation_confirmations_hr\` SET
            \`assessment_job_knowledge\` = ?, \`assessment_quality_of_work\` = ?, \`assessment_work_productivity\` = ?,
            \`assessment_communication_skills\` = ?, \`assessment_teamwork_collaboration\` = ?,
            \`assessment_problem_solving_initiative\` = ?, \`assessment_attendance_punctuality\` = ?,
            \`assessment_adaptability_learning\` = ?, \`assessment_responsibility_attitude\` = ?,
            \`assessment_compliance_policies\` = ?,
            \`total_points\` = ?,
            \`overall_recommendation\` = ?, \`proposed_confirmation_date\` = ?, \`extended_probation_period\` = ?,
            \`performance_summary\` = ?,
            \`status\` = ?, \`decision_comment\` = ?, \`decided_by\` = ?, \`decided_at\` = NOW()
        WHERE \`id\` = ?
    `;

    db.query(query, [
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
        total_points,
        safeVal(overall_recommendation, 50),
        safeVal(proposed_confirmation_date, 20) || null,
        safeNum(extended_probation_period) || null,
        safeVal(performance_summary, 0),
        status,
        safeVal(comment, 0) || null,
        safeVal(decided_by, 20) || null,
        id
    ], (err, result) => {
        if (err) {
            console.error('Probation Decision SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Probation confirmation record not found.' });
        }
        return res.json({ success: true, message: `Probation confirmation ${status.toLowerCase()} successfully!`, total_points });
    });
});

module.exports = router;