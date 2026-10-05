'use strict';

const { sendEmail } = require('./email-service');
const {
    resolveApproverRecipients,
    resolveOutcomeRecipients
} = require('./p1-email');
const { ROLES, norm, problem, requestId, isHOD, freshUser, canAct, canRead, validatePending, canOpenQueue } = require('./resignation-approval');
const isHR = u => ['hr', 'human resources'].includes(norm(u.department)) || ['hr', 'human resources', 'hr specialist'].includes(norm(u.position));

// HR only fills Request Information, Employee Information, and
// Reason/Remarks at submission time (see hr/probation-confirmation-form.html
// - the Probation Assessment / Confirmation Recommendation / Performance
// Summary sections are locked out for HR there and are meant to be completed
// later by the Manager/HOD from the Approval Queue). Submission therefore
// only requires the fields below; the assessment fields are intentionally
// left for a later step and are not yet wired up (no endpoint captures them
// on decision yet - flagged separately, out of scope of this validation).
function validate(body) {
    if (!body || typeof body !== 'object') throw problem(400, 'Request body required.');
    const out = {};
    for (const [key, max] of [['employee_id', 20], ['probation_period', 50], ['probation_end_date', 10]]) {
        if (typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > max) throw problem(400, 'Invalid ' + key + '.');
        out[key] = body[key].trim();
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(out.probation_end_date)) throw problem(400, 'Use YYYY-MM-DD for probation_end_date.');
    const d = new Date(out.probation_end_date + 'T00:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== out.probation_end_date || Number(out.probation_end_date.slice(0, 4)) < 1000) throw problem(400, 'Invalid probation end date.');
    if (body.reason_remarks != null && (typeof body.reason_remarks !== 'string' || body.reason_remarks.length > 10000)) throw problem(400, 'Reason/Remarks must be text up to 10000 characters.');
    out.reason_remarks = body.reason_remarks?.trim() || '';
    return out;
}
async function submit(c, sessionId, body, attachment) {
    const b = validate(body); let started = false;
    try {
        await c.beginTransaction(); started = true;
        const requester = await freshUser(c, sessionId, true);
        if (!isHR(requester)) throw problem(403, 'Only HR can initiate probation confirmation.');
        const [users] = await c.query('SELECT user_id, name, department, position, employment_type, join_date FROM users WHERE LOWER(user_id) = LOWER(?) FOR SHARE', [b.employee_id]);
        if (users.length !== 1) throw problem(404, 'Employee not found.');
        const e = users[0];
        if (!norm(e.department)) throw problem(400, 'Employee department is required for HOD approval.');
        // Preserve the employee snapshot; never trust posted identity, salary, or status.
        const [insert] = await c.query(`INSERT INTO probation_confirmations
            (requested_by,request_date,department,employee_id,employee_name,employee_department,
            position,employment_type,employment_date,probation_period,probation_end_date,
            reason_remarks,supporting_document,status,created_at)
            VALUES (?,CURDATE(),?,?,?,?,?,?,?,?,?,?,?,'Pending',NOW())`,
            [requester.user_id, requester.department, e.user_id, e.name, e.department, e.position, e.employment_type, e.join_date,
            b.probation_period, b.probation_end_date, b.reason_remarks, attachment || null]);
        const rows = ROLES.map((role, i) => [insert.insertId, i + 1, role + ' Approval', role, i === 0 ? 'Pending' : 'Waiting']);
        await c.query('INSERT INTO probation_approval_steps (probation_id,step_order,step_label,approver_role,status) VALUES ?', [rows]);
        await c.commit(); started = false;
        try {
            const firstRole = ROLES[0];

            const recipients = await resolveApproverRecipients(
                c,
                firstRole,
                e.department
            );

            if (!recipients.length) {
                console.warn(
                    `[EMAIL] No recipient found for first approver ${firstRole} ` +
                    `on REQ-PROBATION-${insert.insertId}`
                );
            }

            for (const recipient of recipients) {
                await sendEmail({
                    to: recipient.email,
                    subject:
                        `Approval Required: REQ-PROBATION-${insert.insertId}`,
                    text:
                        `Hi ${recipient.name || recipient.user_id},\n\n` +
                        `A Probation Confirmation request requires your approval.\n` +
                        `Request: REQ-PROBATION-${insert.insertId}\n` +
                        `Role: ${firstRole}\n\n` +
                        `Please log in to the FocusInsight OA System to review the request.`
                });
            }
        } catch (emailError) {
            console.error(
                '[EMAIL] Probation first approver notification failed:',
                emailError.message
            );
        }
        return { success: true, id: insert.insertId, status: 'Pending', message: 'Probation confirmation submitted.', current_step: { step_order: 1, approver_role: ROLES[0] } };
    } catch (error) { if (started) await c.rollback().catch(() => { }); throw error; }
}
// Names of the people who can act for a role. Same matching rules as resolveApproverRecipients
// (p1-email.js) but without requiring an email address. Display only (approval timeline).
async function approverNamesFor(c, role, department) {
    const r = norm(role);
    let where, params = [];
    if (r === 'head of department') {
        where = "LOWER(TRIM(position)) IN ('manager','head of department','hod') AND LOWER(TRIM(department)) = LOWER(TRIM(?))";
        params = [department];
    } else if (r === 'vgm' || r === 'ceo' || r === 'chairman') {
        where = 'LOWER(TRIM(position)) = ?';
        params = [r];
    } else if (r === 'hr specialist') {
        where = "LOWER(TRIM(position)) = 'hr specialist' AND LOWER(TRIM(department)) IN ('hr','human resources')";
    } else return [];
    const [rows] = await c.query(`SELECT name FROM users WHERE ${where} ORDER BY user_id`, params);
    return rows.map(x => x.name).filter(Boolean);
}
async function details(c, sessionId, idValue) {
    const id = requestId(idValue), user = await freshUser(c, sessionId);
    const [rows] = await c.query(`
    SELECT
        p.*,
        u.phone_no AS employee_phone_no,
        u.email AS employee_email
    FROM probation_confirmations p
    LEFT JOIN users u
        ON u.user_id = p.employee_id
    WHERE p.id = ?
`, [id]);
    if (!rows.length) throw problem(404, 'Probation confirmation not found.');
    const record = rows[0];

    const access = {
        ...record,
        department: record.employee_department
    };

    const data = {
        ...record,
        requester_department: record.department,
        department: record.employee_department,
        phone_no: record.employee_phone_no || null,
        email: record.employee_email || null
    };
    if (!canRead(user, access)) throw problem(403, 'Access denied for this probation request.');
    const [steps] = await c.query(`SELECT s.*,u.name AS acted_by_name FROM probation_approval_steps s
        LEFT JOIN users u ON u.user_id=s.acted_by WHERE s.probation_id=? ORDER BY s.step_order`, [id]);
    const current = record.status === 'Pending' ? validatePending(access, steps) : null;

    // Approval timeline data. Every name comes from the database - nothing is hardcoded.
    const [initiatorRows] = await c.query('SELECT name FROM users WHERE LOWER(user_id) = LOWER(?) LIMIT 1', [record.requested_by]);
    const [ccRows] = await c.query(`SELECT u.user_id, u.name, u.position, u.department
        FROM probation_cc_recipients r JOIN users u ON LOWER(u.user_id) = LOWER(r.user_id) ORDER BY r.user_id`);
    const approvalSteps = [];
    for (const s of steps) {
        const notActedYet = !s.acted_by && ['Pending', 'Waiting'].includes(s.status);
        approvalSteps.push({
            ...s,
            acted_by_id: s.acted_by || null,
            acted_by: s.acted_by_name || s.acted_by || null,
            approver_name: notActedYet ? (await approverNamesFor(c, s.approver_role, record.employee_department)).join(' / ') : ''
        });
    }
    data.initiator_name = (initiatorRows[0] && initiatorRows[0].name) || record.requested_by || null;
    data.approval_steps = approvalSteps;
    data.cc_recipients = ccRows;

    return {
        success: true,
        id,
        status: record.status,
        data: data,
        steps,
        current_step: current
            ? {
                step_order: Number(current.step_order),
                approver_role: current.approver_role
            }
            : null,
        can_approve: canAct(user, access, current)
    };
}
async function queue(c, sessionId) {
    const user = await freshUser(c, sessionId);
    if (!canOpenQueue(user)) throw problem(403, 'Approver account required.');
    const [rows] = await c.query(`SELECT p.id,p.requested_by,p.employee_id,p.employee_name,
        p.employee_department AS department,p.status,p.recommendation,p.created_at,
        'Probation Confirmation' AS request_type,s.step_order,s.approver_role,s.status AS step_status
        FROM probation_confirmations p JOIN probation_approval_steps s ON s.probation_id=p.id
        WHERE p.status='Pending' AND s.status='Pending'
        AND LOWER(TRIM(s.approver_role)) <> 'head of department'
        ORDER BY p.created_at DESC,p.id DESC`);
    return { success: true, data: rows.filter(r => canAct(user, r, { status: r.step_status, approver_role: r.approver_role })).map(r => ({ ...r, can_approve: true })) };
}
async function mine(c, sessionId) {
    const user = await freshUser(c, sessionId);
    const [rows] = await c.query(`SELECT id,employee_id,employee_name,employee_department,request_date,recommendation,status,created_at,
        'Probation Confirmation' AS request_type FROM probation_confirmations WHERE requested_by=? ORDER BY created_at DESC,id DESC`, [user.user_id]);
    return { success: true, data: rows };
}
async function notifications(c, sessionId) {
    const user = await freshUser(c, sessionId);
    const [rows] = await c.query(`SELECT id AS notification_id,probation_id AS id,outcome AS status,created_at AS time,
        'Probation Confirmation' AS type FROM probation_notifications WHERE recipient_id=? ORDER BY id DESC`, [user.user_id]);
    return { success: true, notifications: rows };
}
async function decide(connection, sessionUserId, idValue, body) {
    const id = requestId(idValue);
    if (!body || !['Approved', 'Rejected'].includes(body.status)) {
        throw problem(400, 'Status must be Approved or Rejected.');
    }

    const suppliedStep =
        body.step_order == null
            ? null
            : Number(body.step_order);

    if (
        suppliedStep !== null &&
        (
            !Number.isInteger(suppliedStep) ||
            suppliedStep < 1 ||
            suppliedStep > 5
        )
    ) {
        throw problem(400, 'Invalid step_order.');
    }

    const remarks =
        body.remarks ??
        body.comment ??
        null;

    if (
        remarks != null &&
        (
            typeof remarks !== 'string' ||
            remarks.length > 2000
        )
    ) {
        throw problem(
            400,
            'Remarks must be text with at most 2000 characters.'
        );
    }
    let started = false;
    try {
        await connection.beginTransaction(); started = true;
        const user = await freshUser(connection, sessionUserId, true);
        const [requests] = await connection.query(
            `SELECT
                id,
                employee_department AS department,
                requested_by,
                employee_id,
                status,
                total_points,
                overall_recommendation,
                assessed_by,
                assessed_at
            FROM probation_confirmations
            WHERE id = ?
            FOR UPDATE`,
            [id]
        );
        if (!requests.length) throw problem(404, 'Probation request not found.');
        const record = requests[0];
        if (!canRead(user, record)) throw problem(403, 'Access denied for this probation request.');
        const [steps] = await connection.query(
            'SELECT * FROM probation_approval_steps WHERE probation_id = ? ORDER BY step_order FOR UPDATE', [id]);
        const current = validatePending(record, steps);
        if (
            suppliedStep !== null &&
            Number(current.step_order) !== suppliedStep
        ) {
            throw problem(
                409,
                'Approval step has changed. Reload the request before submitting.'
            );
        }

        const currentRole =
            norm(current.approver_role);

        if (
            body.status === 'Approved' &&
            currentRole === 'head of department' &&
            (
                record.total_points == null ||
                !record.overall_recommendation ||
                !record.assessed_by
            )
        ) {
            throw problem(
                409,
                'Probation assessment must be completed before HOD approval.'
            );
        }

        if (!canAct(user, record, current)) throw problem(403, 'You are not the approver for the current step.');
        const [changed] = await connection.query(
            "UPDATE probation_approval_steps SET status = ?, acted_by = ?, acted_at = NOW(), remarks = ? WHERE id = ? AND status = 'Pending'",
            [body.status, user.user_id, remarks?.trim() || null, current.id]);
        if (changed.affectedRows !== 1) throw problem(409, 'Approval step has already changed.');
        let overall = 'Pending', next = null;
        if (body.status === 'Rejected') {
            overall = 'Rejected';
            await connection.query(
                "UPDATE probation_approval_steps SET status = 'Cancelled' WHERE probation_id = ? AND status = 'Waiting'", [id]);
        } else {
            next = steps.find(s => Number(s.step_order) === Number(current.step_order) + 1) || null;
            if (next) {
                const [activated] = await connection.query(
                    "UPDATE probation_approval_steps SET status = 'Pending' WHERE id = ? AND status = 'Waiting'", [next.id]);
                if (activated.affectedRows !== 1) throw problem(409, 'Next approval step could not be activated.');
            } else overall = 'Approved';
        }
        if (overall !== 'Pending') {
            const [updated] = await connection.query(
                "UPDATE probation_confirmations SET status = ? WHERE id = ? AND status = 'Pending'", [overall, id]);
            if (updated.affectedRows !== 1) throw problem(409, 'Request has already changed.');
        }
        if (overall !== 'Pending') {
            const [requesters] = await connection.query(
                `SELECT user_id
         FROM users
         WHERE LOWER(user_id) = LOWER(?)
         FOR SHARE`,
                [record.requested_by]
            );

            if (requesters.length !== 1) {
                throw problem(409, 'Requesting HR account is missing.');
            }

            const recipients = new Map();

            recipients.set(
                requesters[0].user_id.toLowerCase(),
                {
                    id: requesters[0].user_id,
                    kind: 'outcome'
                }
            );

            if (overall === 'Approved') {
                const [ccRows] = await connection.query(`
            SELECT
                c.user_id,
                u.user_id AS resolved_id
            FROM probation_cc_recipients c
            LEFT JOIN users u
                ON LOWER(u.user_id) = LOWER(c.user_id)
            ORDER BY c.user_id
            FOR SHARE
        `);

                for (const recipient of ccRows) {
                    if (!recipient.resolved_id) {
                        throw problem(
                            409,
                            'Configured probation CC account is missing.'
                        );
                    }

                    const key =
                        recipient.resolved_id.toLowerCase();

                    if (!recipients.has(key)) {
                        recipients.set(key, {
                            id: recipient.resolved_id,
                            kind: 'cc'
                        });
                    }
                }
            }

            for (const recipient of recipients.values()) {
                await connection.query(
                    `INSERT INTO probation_notifications (
                probation_id,
                recipient_id,
                outcome,
                kind,
                message
            )
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE id = id`,
                    [
                        id,
                        recipient.id,
                        overall,
                        recipient.kind,
                        `REQ-PROBATION-${id}: ${overall}${recipient.kind === 'cc'
                            ? ' (CC)'
                            : ''
                        }`
                    ]
                );
            }
        }

        await connection.commit(); started = false;

        // Email only AFTER database commit.
        // Email failure must not undo a successful approval.
        if (next) {
            try {
                const recipients = await resolveApproverRecipients(
                    connection,
                    next.approver_role,
                    record.department
                );

                if (!recipients.length) {
                    console.warn(
                        `[EMAIL] No recipient found for ${next.approver_role} ` +
                        `on REQ-PROBATION-${id}`
                    );
                }

                for (const recipient of recipients) {
                    await sendEmail({
                        to: recipient.email,
                        subject:
                            `Approval Required: REQ-PROBATION-${id}`,
                        text:
                            `Hi ${recipient.name || recipient.user_id},\n\n` +
                            `A Probation Confirmation request requires your approval.\n` +
                            `Request: REQ-PROBATION-${id}\n` +
                            `Role: ${next.approver_role}\n\n` +
                            `Please log in to the FocusInsight OA System to review the request.`
                    });
                }
            } catch (emailError) {
                console.error(
                    '[EMAIL] Probation next approver notification failed:',
                    emailError.message
                );
            }
        }

        if (
            !next &&
            ['Approved', 'Rejected'].includes(overall)
        ) {
            try {
                const recipients = await resolveOutcomeRecipients(
                    connection,
                    record.requested_by,
                    'probation_cc_recipients',
                    overall === 'Approved'
                );

                if (!recipients.length) {
                    console.warn(
                        `[EMAIL] No final outcome recipient for REQ-PROBATION-${id}`
                    );
                }

                for (const recipient of recipients) {
                    const isCc = recipient.kind === 'cc';

                    await sendEmail({
                        to: recipient.email,
                        subject:
                            `${overall}: REQ-PROBATION-${id}`,
                        text:
                            `Hi ${recipient.name || recipient.user_id},\n\n` +
                            `Probation Confirmation REQ-PROBATION-${id} ` +
                            `has been ${overall.toLowerCase()}.\n` +
                            `${isCc
                                ? '\nYou are receiving this email as a CC recipient.\n'
                                : ''
                            }` +
                            `\nPlease log in to the FocusInsight OA System for details.`
                    });
                }
            } catch (emailError) {
                console.error(
                    '[EMAIL] Probation final outcome notification failed:',
                    emailError.message
                );
            }
        }

        return {
            success: true, id, status: overall,
            completed_step: Number(current.step_order), decision: body.status,
            next_step: next ? { step_order: Number(next.step_order), approver_role: next.approver_role } : null
        };
    } catch (error) {
        if (started) await connection.rollback().catch(() => { });
        throw error;
    }
}

// ---------------------------------------------------------------------------
// Manager / HOD probation ASSESSMENT (probation-confirmation-list.html and
// probation-confirmation-detail.html). Saving the assessment IS the HOD's approval step:
// it completes step 1 and hands the request to the VGM. The HOD step never appears in
// the Approval Queue; VGM, CEO, Chairman and HR Specialist still use the Approval Queue.
// ---------------------------------------------------------------------------
const ASSESSMENT_KEYS = [
    'job_knowledge', 'quality_of_work', 'work_productivity', 'communication_skills',
    'teamwork_collaboration', 'problem_solving_initiative', 'attendance_punctuality',
    'adaptability_learning', 'responsibility_attitude', 'compliance_policies'
];
const ASSESSMENT_PASSING_POINTS = 40;
const RECOMMENDATIONS = ['Confirm Employment', 'Extend Probation', 'Do Not Confirm'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = n => String(n).padStart(2, '0');
const ymd = v => {
    if (v == null || v === '') return v;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

async function requireDepartmentHOD(c, sessionId) {
    const user = await freshUser(c, sessionId);
    if (!isHOD(user) || !norm(user.department)) throw problem(403, 'Only a Manager/HOD can assess probation confirmations.');
    return user;
}

// GET /api/probation-confirmation/list : pending, not-yet-assessed requests for the
// HOD's own department. Department comes from the DB, never from the browser.
async function assessmentList(c, sessionId) {
    const user = await requireDepartmentHOD(c, sessionId);
    const [rows] = await c.query(
        `SELECT id, employee_name, created_at FROM probation_confirmations
         WHERE status = 'Pending' AND total_points IS NULL AND LOWER(TRIM(employee_department)) = ?
         ORDER BY created_at DESC, id DESC`, [norm(user.department)]);
    const records = rows.map(r => {
        const d = new Date(r.created_at);
        const h = d.getHours();
        return {
            id: r.id,
            name: r.employee_name,
            submittedDate: `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
            submittedTime: `${h % 12 || 12}:${pad(d.getMinutes())} ${h >= 12 ? 'PM' : 'AM'}`,
            highlighted: false
        };
    });
    return { success: true, records, total: records.length };
}

// GET /api/probation-confirmation/:id : the record for the assessment page. Deliberately does
// NOT validate the approval-step chain (details() does), so older requests that were submitted
// before approval steps existed can still be opened and assessed. Dates come back as YYYY-MM-DD
// so the page's <input type="date"> fields fill correctly.
async function assessmentDetails(c, sessionId, idValue) {
    const id = requestId(idValue), user = await freshUser(c, sessionId);
    const [rows] = await c.query(
        `SELECT p.*, u.phone_no AS employee_phone_no, u.email AS employee_email
         FROM probation_confirmations p LEFT JOIN users u ON u.user_id = p.employee_id
         WHERE p.id = ?`, [id]);
    if (!rows.length) throw problem(404, 'Probation confirmation not found.');
    const record = rows[0];
    if (!canRead(user, { ...record, department: record.employee_department })) {
        throw problem(403, 'Access denied for this probation request.');
    }
    const data = {
        ...record,
        requester_department: record.department,
        phone_no: record.employee_phone_no || null,
        email: record.employee_email || null
    };
    for (const k of ['request_date', 'probation_end_date', 'proposed_confirmation_date', 'employment_date']) {
        if (data[k] instanceof Date) data[k] = ymd(data[k]);
    }
    return { success: true, id, status: record.status, data };
}

// POST /api/probation-confirmation/:id/assessment
async function assess(c, sessionId, idValue, body) {
    const id = requestId(idValue);
    const user = await requireDepartmentHOD(c, sessionId);
    body = body || {};

    const scores = {};
    let total = 0;
    for (const key of ASSESSMENT_KEYS) {
        const raw = String(body['assessment_' + key] ?? '').trim();
        if (!/^[1-5]$/.test(raw)) throw problem(400, 'Rate every assessment item from 1 to 5.');
        scores[key] = Number(raw);
        total += scores[key];
    }

    const recommendation = String(body.overall_recommendation || '').trim();
    if (!RECOMMENDATIONS.includes(recommendation)) throw problem(400, 'Select a valid Overall Recommendation.');

    let proposedDate = null, extendedPeriod = null;
    if (recommendation === 'Confirm Employment') {
        proposedDate = String(body.proposed_confirmation_date || '').trim();
        const d = new Date(proposedDate);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(proposedDate) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== proposedDate) {
            throw problem(400, 'Proposed Confirmation Date must be a valid YYYY-MM-DD date.');
        }
    } else if (recommendation === 'Extend Probation') {
        extendedPeriod = String(body.extended_probation_period || '').trim();
        if (!extendedPeriod || extendedPeriod.length > 100) throw problem(400, 'Extended Probation Period is required (max 100 characters).');
    }

    const summary = String(body.performance_summary || '').trim();
    if (!summary) throw problem(400, 'Comments supporting the recommendation are required.');
    if (summary.length > 10000) throw problem(400, 'Comments must be 10000 characters or fewer.');

    let started = false, rec = null, next = null;
    try {
        await c.beginTransaction(); started = true;
        const [rows] = await c.query('SELECT id, status, employee_department, total_points FROM probation_confirmations WHERE id = ? FOR UPDATE', [id]);
        if (!rows.length) throw problem(404, 'Probation confirmation not found.');
        rec = rows[0];
        if (norm(rec.employee_department) !== norm(user.department)) throw problem(403, 'This request belongs to a different department.');
        if (rec.status !== 'Pending') throw problem(409, 'This request is already completed or rejected.');
        if (rec.total_points !== null && rec.total_points !== undefined) throw problem(409, 'This request has already been assessed.');

        const setCols = ASSESSMENT_KEYS.map(k => `assessment_${k} = ?`).join(', ');
        const [result] = await c.query(
            `UPDATE probation_confirmations SET ${setCols}, total_points = ?, passing_points = ?,
                overall_recommendation = ?, proposed_confirmation_date = ?, extended_probation_period = ?,
                performance_summary = ?, assessed_by = ?, assessed_at = NOW()
             WHERE id = ? AND status = 'Pending' AND total_points IS NULL`,
            [...ASSESSMENT_KEYS.map(k => scores[k]), total, ASSESSMENT_PASSING_POINTS,
                recommendation, proposedDate, extendedPeriod, summary, user.user_id, id]);
        if (result.affectedRows !== 1) throw problem(409, 'This request has already been assessed.');

        // The assessment is the HOD's approval step: complete it and activate the next approver.
        // Requests created before approval steps existed have no steps and are left as they are.
        const [steps] = await c.query('SELECT * FROM probation_approval_steps WHERE probation_id = ? ORDER BY step_order FOR UPDATE', [id]);
        if (steps.length) {
            const current = validatePending(rec, steps);
            if (norm(current.approver_role) !== 'head of department') throw problem(409, 'The HOD step is not the current approval step.');
            const [changed] = await c.query(
                "UPDATE probation_approval_steps SET status = 'Approved', acted_by = ?, acted_at = NOW(), remarks = ? WHERE id = ? AND status = 'Pending'",
                [user.user_id, 'Probation assessment completed', current.id]);
            if (changed.affectedRows !== 1) throw problem(409, 'Approval step has already changed.');
            next = steps.find(st => Number(st.step_order) === Number(current.step_order) + 1) || null;
            if (next) {
                const [activated] = await c.query("UPDATE probation_approval_steps SET status = 'Pending' WHERE id = ? AND status = 'Waiting'", [next.id]);
                if (activated.affectedRows !== 1) throw problem(409, 'Next approval step could not be activated.');
            }
        }
        await c.commit(); started = false;
    } catch (error) { if (started) await c.rollback().catch(() => { }); throw error; }

    // Email only AFTER the commit; an email failure must not undo the assessment.
    if (next) {
        try {
            const recipients = await resolveApproverRecipients(c, next.approver_role, rec.employee_department);
            if (!recipients.length) console.warn(`[EMAIL] No recipient found for ${next.approver_role} on REQ-PROBATION-${id}`);
            for (const recipient of recipients) {
                await sendEmail({
                    to: recipient.email,
                    subject: `Approval Required: REQ-PROBATION-${id}`,
                    text: `Hi ${recipient.name || recipient.user_id},\n\n` +
                        `A Probation Confirmation request requires your approval.\n` +
                        `Request: REQ-PROBATION-${id}\n` +
                        `Role: ${next.approver_role}\n\n` +
                        `Please log in to the FocusInsight OA System to review the request.`
                });
            }
        } catch (emailError) {
            console.error('[EMAIL] Probation next approver notification failed:', emailError.message);
        }
    }
    return { success: true, id, total_points: total, passing_points: ASSESSMENT_PASSING_POINTS, passed: total >= ASSESSMENT_PASSING_POINTS };
}

module.exports = { validate, submit, details, queue, mine, notifications, decide, assessmentList, assessmentDetails, assess };