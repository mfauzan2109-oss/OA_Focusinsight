const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ==========================================================================
// API ROUTE: IT REPORT — 5 HR forms, APPROVED ONLY
// Letak fail ni dalam routes/ dan daftar dalam routes/index.js macam reports.routes.js
// ==========================================================================

// Status yang dikira "dah approve" (dibandingkan lepas TRIM + lowercase)
const APPROVED_STATUSES = ['approved', 'fully approved'];

// Satu entri setiap form (nama table & column ikut skema portal_oa).
// Kalau column berlainan nama / ada ruang (cth. `Employee ID`), tulis dengan backtick.
const standard = (type, table, over = {}) => ({
    type,
    table,
    id: 'f.id',
    empId: 'f.employee_id',
    empName: 'f.employee_name',
    dept: 'f.department',
    date: 'f.created_at',
    status: 'f.status',
    ...over
});

// Jabatan employee: contract_renewals & probation_confirmations ada `department` (jabatan pemohon)
// dan `employee_department` (jabatan pekerja) -> report guna jabatan pekerja.
const EMP_DEPT = "COALESCE(NULLIF(TRIM(f.employee_department), ''), f.department)";

const FORM_SOURCES = [
    standard('Hiring Approval Form',              '`hiring_approvals`'),
    standard('Probation Confirmation Form',       '`probation_confirmations`', { dept: EMP_DEPT }),
    standard('Contract Renewal Form',             '`contract_renewals`',       { dept: EMP_DEPT }),
    standard('Resignation Request Form',          '`resignations`'),
    standard('Manpower Outsourcing Request Form', '`manpower_outsourcing_requests`')   // TODO: skema belum dihantar, sahkan nama table & column
];

const SORT_FIELDS = ['employee_id', 'employee_name', 'department', 'request_date'];

router.get('/api/it-reports', (req, res) => {
    const { request_type, department, date_from, date_to, search_value, search_field, sort_by, sort_order } = req.query;

    const approvedMarks = APPROVED_STATUSES.map(() => '?').join(',');

    // Bina query + params untuk satu form (setiap form ada array params sendiri, macam /api/reports)
    const buildQuery = (s) => {
        const params = [...APPROVED_STATUSES];
        let sql = `SELECT ${s.id} AS id, '${s.type}' AS request_type, ${s.empName} AS employee_name, ` +
                  `${s.empId} AS employee_id, ${s.dept} AS department, ${s.date} AS request_date, u.profile_picture ` +
                  `FROM ${s.table} f LEFT JOIN users u ON LOWER(u.user_id) = LOWER(${s.empId} COLLATE utf8mb4_general_ci) ` +
                  `WHERE LOWER(TRIM(${s.status})) IN (${approvedMarks})`;   // <-- hanya yang dah approve

        if (department && department !== 'All Departments') {
            sql += ` AND LOWER(TRIM(${s.dept})) = LOWER(TRIM(?))`;
            params.push(department);
        }
        if (date_from) { sql += ` AND DATE(${s.date}) >= ?`; params.push(date_from); }
        if (date_to)   { sql += ` AND DATE(${s.date}) <= ?`; params.push(date_to); }

        if (search_value) {
            const searchColumns = {
                employee_id: s.empId,
                employee_name: s.empName,
                department: s.dept,
                request_date: `CAST(${s.date} AS CHAR)`
            };
            const col = searchColumns[search_field] || searchColumns.employee_id;
            sql += ` AND LOWER(${col}) LIKE LOWER(?)`;
            params.push(`%${search_value}%`);
        }
        return { sql, params };
    };

    // Kalau satu form error (cth. nama table salah) -> log di console, form lain tetap jalan
    const exec = (s) => new Promise(resolve => {
        const { sql, params } = buildQuery(s);
        db.query(sql, params, (err, rows) => {
            if (err) console.error(`IT Report query failed for "${s.type}":`, err.message);
            resolve(rows || []);
        });
    });

    const wanted = FORM_SOURCES.filter(s =>
        !request_type || request_type === 'All Forms' || request_type === s.type
    );

    Promise.all(wanted.map(exec)).then(results => {
        const combined = results.flat();

        combined.forEach(item => {
            let formattedDate = '—';
            if (item.request_date) {
                try {
                    const d = new Date(item.request_date);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = d.toLocaleString('en-US', { month: 'short' });
                    formattedDate = `${day}-${month}-${d.getFullYear()}`;
                } catch (e) {}
            }
            item.formatted_date = formattedDate;

            const yearStr = item.request_date ? new Date(item.request_date).getFullYear() : '2026';
            item.request_id = `REQ-${yearStr}-${String(item.id).padStart(3, '0')}`;
        });

        combined.sort((a, b) => new Date(b.request_date) - new Date(a.request_date));

        if (SORT_FIELDS.includes(sort_by)) {
            const dir = (sort_order === 'desc') ? -1 : 1;
            combined.sort((a, b) => {
                if (sort_by === 'request_date') return (new Date(a.request_date) - new Date(b.request_date)) * dir;
                const valA = (a[sort_by] || '').toString().toLowerCase();
                const valB = (b[sort_by] || '').toString().toLowerCase();
                return valA.localeCompare(valB) * dir;
            });
        }

        return res.json({ success: true, count: combined.length, data: combined });
    }).catch(err => {
        console.error('IT Reports Error:', err);
        return res.status(500).json({ success: false, message: 'Database error fetching IT report.' });
    });
});

module.exports = router;