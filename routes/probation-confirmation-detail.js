const express = require('express');
const router = express.Router();
const db = require('../config/db');
const upload = require('../middleware/upload');
const { safeVal, safeNum } = require('../utils/helpers');

// ==========================================================================
// AUTH HELPER — GET THE REAL LOGGED-IN USER, SERVER-SIDE
// ==========================================================================
// This is the ONLY place that matters for security. Everything else in this
// file can be perfect and it still won't matter if this function trusts
// something the client can edit (like a body field or a header nobody
// verifies).
//
// Tries the three most common patterns in order. DELETE the branches that
// don't apply to your app once you know your auth setup, and keep only the
// one that reflects how login actually works for you:
//
//   1. Express session (e.g. express-session / passport):
//        the logged-in user's id would already be on req.session.user.id
//   2. JWT in an Authorization header, verified by upstream middleware
//        that already ran and attached req.user
//   3. A temporary/dev-only fallback that trusts an x-user-id header —
//        this is NOT secure (anyone can set any header), it's only here
//        so the endpoint fails closed instead of silently doing nothing.
//        Remove this branch once you have real auth.
//
// Whichever one applies, the function must return the CALLER's id, looked
// up from something the server itself verified (a signed cookie, a
// verified JWT) — never from req.body.
function getRequestingUserId(req) {
    if (req.session && req.session.user && req.session.user.id) {
        return req.session.user.id; // pattern 1: express-session
    }
    if (req.user && req.user.id) {
        return req.user.id; // pattern 2: passport/JWT middleware
    }
    if (req.headers['x-user-id']) {
        return req.headers['x-user-id']; // pattern 3: TEMPORARY, not secure
    }
    return null;
}

// Looks up the requesting user's role/position AND department from the DB.
// Adjust table/column names to match your schema.
function getUserContext(userId) {
    return new Promise((resolve, reject) => {
        db.query(
            'SELECT position, department FROM `users` WHERE `user_id` = ? LIMIT 1',
            [userId],
            (err, rows) => {
                if (err) return reject(err);
                resolve(rows && rows[0] ? { role: rows[0].position, department: rows[0].department } : null);
            }
        );
    });
}

const MANAGER_ROLES = ['Manager', 'HOD', 'Head of Department']; // adjust to your actual role strings

// Role + department gate for a SPECIFIC record. Blocks the request unless
// the verified caller is a Manager/HOD AND their department matches the
// employee's department on that record — an Electrical Manager can't
// assess a Sales employee's probation, even though they're both "Manager".
// Fails CLOSED — if identity can't be established, the request is rejected,
// it does not fall back to trusting the client.
async function requireManagerOrHODForRecord(req, res, next) {
    const userId = getRequestingUserId(req);
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    try {
        const ctx = await getUserContext(userId);
        if (!ctx || !MANAGER_ROLES.includes(ctx.role)) {
            return res.status(403).json({ success: false, message: 'Only a Manager or HOD can submit the probation assessment and recommendation.' });
        }
        db.query(
            'SELECT employee_department FROM `probation_confirmations_hr` WHERE `id` = ? LIMIT 1',
            [req.params.id],
            (err, rows) => {
                if (err) {
                    console.error('Department check SQL Error:', err);
                    return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
                }
                if (!rows || !rows[0]) {
                    return res.status(404).json({ success: false, message: 'Probation confirmation request not found.' });
                }
                if (rows[0].employee_department !== ctx.department) {
                    return res.status(403).json({ success: false, message: 'This request belongs to a different department.' });
                }
                req.verifiedUserId = userId;
                req.verifiedRole = ctx.role;
                req.verifiedDepartment = ctx.department;
                next();
            }
        );
    } catch (err) {
        console.error('Role lookup failed:', err);
        return res.status(500).json({ success: false, message: 'Could not verify permissions.' });
    }
}

// ==========================================================================
// GET A SINGLE REQUEST — powers the detail page's read-only section (all
// the Request Info / Employee Info / Reason-Remarks HR already filled in).
// No role check here: both HR (checking status) and the assigned
// Manager/HOD (about to assess it) need to be able to load this. The
// department-eligibility check for actually SUBMITTING happens separately
// below, in requireManagerOrHODForRecord.
// ==========================================================================
router.get('/api/probation-confirmation/:id', (req, res) => {
    const query = `
        SELECT
            pc.*,
            mc.id                                     AS manager_record_id,
            mc.assessed_by                            AS assessed_by,
            mc.assessment_job_knowledge                AS assessment_job_knowledge,
            mc.assessment_quality_of_work               AS assessment_quality_of_work,
            mc.assessment_work_productivity             AS assessment_work_productivity,
            mc.assessment_communication_skills          AS assessment_communication_skills,
            mc.assessment_teamwork_collaboration        AS assessment_teamwork_collaboration,
            mc.assessment_problem_solving_initiative    AS assessment_problem_solving_initiative,
            mc.assessment_attendance_punctuality        AS assessment_attendance_punctuality,
            mc.assessment_adaptability_learning         AS assessment_adaptability_learning,
            mc.assessment_responsibility_attitude       AS assessment_responsibility_attitude,
            mc.assessment_compliance_policies           AS assessment_compliance_policies,
            mc.total_points                             AS total_points,
            mc.passing_points                           AS passing_points,
            mc.overall_recommendation                   AS overall_recommendation,
            mc.proposed_confirmation_date               AS proposed_confirmation_date,
            mc.extended_probation_period                AS extended_probation_period,
            mc.performance_summary                      AS performance_summary,
            mc.status                                   AS manager_status,
            mc.assessed_at                              AS assessed_at
        FROM \`probation_confirmations_hr\` pc
        LEFT JOIN \`probation_confirmations_manager\` mc ON mc.confirmation_id = pc.id
        WHERE pc.id = ?
        LIMIT 1
    `;
    db.query(query, [req.params.id], (err, rows) => {
        if (err) {
            console.error('Probation Confirmation Fetch SQL Error:', err);
            return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
        }
        if (!rows || !rows[0]) {
            return res.status(404).json({ success: false, message: 'Probation confirmation request not found.' });
        }
        return res.json({ success: true, data: rows[0] });
    });
});

// ==========================================================================
// MANAGER/HOD SUBMITS THE ASSESSMENT — powers the editable part of the
// detail page. requireManagerOrHODForRecord runs BEFORE this handler; if
// the verified caller isn't the matching-department Manager/HOD, the
// request never reaches this code.
// ==========================================================================
router.post('/api/probation-confirmation/:id/assessment', upload.none(), requireManagerOrHODForRecord, (req, res) => {
    const recordId = req.params.id;
    const {
        assessment_job_knowledge, assessment_quality_of_work, assessment_work_productivity,
        assessment_communication_skills, assessment_teamwork_collaboration,
        assessment_problem_solving_initiative, assessment_attendance_punctuality,
        assessment_adaptability_learning, assessment_responsibility_attitude,
        assessment_compliance_policies,
        total_points, passing_points,
        overall_recommendation, proposed_confirmation_date, extended_probation_period,
        performance_summary
    } = req.body;

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

    // Guard: don't allow a second assessment row for the same HR request.
    db.query(
        'SELECT id FROM `probation_confirmations_manager` WHERE `confirmation_id` = ? LIMIT 1',
        [recordId],
        (checkErr, existingRows) => {
            if (checkErr) {
                console.error('Duplicate-assessment check SQL Error:', checkErr);
                return res.status(500).json({ success: false, message: 'Database Error: ' + checkErr.message });
            }
            if (existingRows && existingRows[0]) {
                return res.status(409).json({ success: false, message: 'This request has already been assessed.' });
            }

            const query = `
                INSERT INTO \`probation_confirmations_manager\` (
                    \`confirmation_id\`, \`assessed_by\`,
                    \`assessment_job_knowledge\`, \`assessment_quality_of_work\`, \`assessment_work_productivity\`,
                    \`assessment_communication_skills\`, \`assessment_teamwork_collaboration\`,
                    \`assessment_problem_solving_initiative\`, \`assessment_attendance_punctuality\`,
                    \`assessment_adaptability_learning\`, \`assessment_responsibility_attitude\`,
                    \`assessment_compliance_policies\`,
                    \`total_points\`, \`passing_points\`,
                    \`overall_recommendation\`, \`proposed_confirmation_date\`, \`extended_probation_period\`,
                    \`performance_summary\`, \`status\`, \`assessed_at\`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())
            `;

            db.query(query, [
                recordId,
                req.verifiedUserId,
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
                    console.error('Probation Assessment SQL Error:', err);
                    return res.status(500).json({ success: false, message: 'Database Error: ' + err.message });
                }
                return res.json({ success: true, message: 'Probation assessment submitted successfully!' });
            });
        }
    );
});

module.exports = router;