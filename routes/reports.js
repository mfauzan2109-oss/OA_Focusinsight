const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const cron = require('node-cron');
const db = require('../config/db');

// ==========================================================================
// API ROUTE: FETCH REPORTS WITH FILTERS
// ==========================================================================
router.get('/api/reports', (req, res) => {
    const { request_type, department, date_from, date_to, search_value, search_field, sort_by, sort_order } = req.query;

    let leaveQuery  = `SELECT l.ID as id, 'Leave Application' as request_type, l.\`Employee Name\` as employee_name, l.\`Employee ID\` as employee_id, l.Department as department, l.\`Created At\` as request_date, u.profile_picture FROM \`leave\` l LEFT JOIN users u ON LOWER(u.user_id) = LOWER(l.\`Employee ID\` COLLATE utf8mb4_general_ci) WHERE 1=1`;
    let disQuery    = `SELECT d.id, 'Disbursement Form' as request_type, d.employee_name, d.employee_id, d.department, d.created_at as request_date, u.profile_picture FROM \`disbursements\` d LEFT JOIN users u ON LOWER(u.user_id) = LOWER(d.employee_id COLLATE utf8mb4_general_ci) WHERE 1=1`;
    let travelQuery = `SELECT t.id, 'Travel Request' as request_type, t.employee_name, t.employee_id, t.department, t.created_at as request_date, u.profile_picture FROM \`travel\` t LEFT JOIN users u ON LOWER(u.user_id) = LOWER(t.employee_id COLLATE utf8mb4_general_ci) WHERE 1=1`;
    let otQuery     = `SELECT o.id, 'Overtime Claim' as request_type, o.employee_name, o.employee_id, o.department, o.created_at as request_date, u.profile_picture FROM \`overtime\` o LEFT JOIN users u ON LOWER(u.user_id) = LOWER(o.employee_id COLLATE utf8mb4_general_ci) WHERE 1=1`;
    let loanQuery   = `SELECT ln.id, 'Loan Application' as request_type, ln.employee_name, ln.employee_id, ln.department, ln.created_at as request_date, u.profile_picture FROM \`loans\` ln LEFT JOIN users u ON LOWER(u.user_id) = LOWER(ln.employee_id COLLATE utf8mb4_general_ci) WHERE 1=1`;

    const params = [];

    if (department && department !== 'All Departments') {
        leaveQuery  += ` AND LOWER(TRIM(l.Department)) = LOWER(TRIM(?))`;
        disQuery    += ` AND LOWER(TRIM(d.department)) = LOWER(TRIM(?))`;
        travelQuery += ` AND LOWER(TRIM(t.department)) = LOWER(TRIM(?))`;
        otQuery     += ` AND LOWER(TRIM(o.department)) = LOWER(TRIM(?))`;
        loanQuery   += ` AND LOWER(TRIM(ln.department)) = LOWER(TRIM(?))`;
        params.push(department, department, department, department, department);
    }

    if (date_from) {
        leaveQuery  += ` AND DATE(l.\`Created At\`) >= ?`;
        disQuery    += ` AND DATE(d.created_at) >= ?`;
        travelQuery += ` AND DATE(t.created_at) >= ?`;
        otQuery     += ` AND DATE(o.created_at) >= ?`;
        loanQuery   += ` AND DATE(ln.created_at) >= ?`;
        params.push(date_from, date_from, date_from, date_from, date_from);
    }

    if (date_to) {
        leaveQuery  += ` AND DATE(l.\`Created At\`) <= ?`;
        disQuery    += ` AND DATE(d.created_at) <= ?`;
        travelQuery += ` AND DATE(t.created_at) <= ?`;
        otQuery     += ` AND DATE(o.created_at) <= ?`;
        loanQuery   += ` AND DATE(ln.created_at) <= ?`;
        params.push(date_to, date_to, date_to, date_to, date_to);
    }

    if (search_value) {
        // Which column to search depends on what's selected in "Sort by" on the
        // frontend (defaults to Employee ID when nothing is selected).
        const searchColumns = {
            employee_id: {
                leave: 'l.`Employee ID`', dis: 'd.employee_id', travel: 't.employee_id',
                ot: 'o.employee_id', loan: 'ln.employee_id'
            },
            employee_name: {
                leave: 'l.`Employee Name`', dis: 'd.employee_name', travel: 't.employee_name',
                ot: 'o.employee_name', loan: 'ln.employee_name'
            },
            department: {
                leave: 'l.Department', dis: 'd.department', travel: 't.department',
                ot: 'o.department', loan: 'ln.department'
            },
            request_date: {
                leave: 'CAST(l.`Created At` AS CHAR)', dis: 'CAST(d.created_at AS CHAR)', travel: 'CAST(t.created_at AS CHAR)',
                ot: 'CAST(o.created_at AS CHAR)', loan: 'CAST(ln.created_at AS CHAR)'
            }
        };

        const field = searchColumns[search_field] ? search_field : 'employee_id';
        const cols = searchColumns[field];

        leaveQuery  += ` AND LOWER(${cols.leave}) LIKE LOWER(?)`;
        disQuery    += ` AND LOWER(${cols.dis}) LIKE LOWER(?)`;
        travelQuery += ` AND LOWER(${cols.travel}) LIKE LOWER(?)`;
        otQuery     += ` AND LOWER(${cols.ot}) LIKE LOWER(?)`;
        loanQuery   += ` AND LOWER(${cols.loan}) LIKE LOWER(?)`;
        const likeVal = `%${search_value}%`;
        params.push(likeVal, likeVal, likeVal, likeVal, likeVal);
    }

    const runLeave  = !request_type || request_type === 'All Requests' || request_type === 'Leave Application';
    const runDisb   = !request_type || request_type === 'All Requests' || request_type === 'Disbursement Form';
    const runTravel = !request_type || request_type === 'All Requests' || request_type === 'Travel Request';
    const runOT     = !request_type || request_type === 'All Requests' || request_type === 'Overtime Claim';
    const runLoan   = !request_type || request_type === 'All Requests' || request_type === 'Loan Application';

    const exec = (sql, p) => new Promise(resolve => db.query(sql, p, (e, r) => resolve(r || [])));

    Promise.all([
        runLeave ? exec(leaveQuery, params) : [],
        runDisb ? exec(disQuery, params) : [],
        runTravel ? exec(travelQuery, params) : [],
        runOT ? exec(otQuery, params) : [],
        runLoan ? exec(loanQuery, params) : []
    ]).then(([leaves, disbs, travels, ots, loans]) => {
        let combined = [...leaves, ...disbs, ...travels, ...ots, ...loans];

        combined.forEach(item => {
            let formattedDate = '—';
            if (item.request_date) {
                try {
                    const d = new Date(item.request_date);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = d.toLocaleString('en-US', { month: 'short' });
                    const year = d.getFullYear();
                    formattedDate = `${day}-${month}-${year}`;
                } catch(e) {}
            }
            item.formatted_date = formattedDate;

            const yearStr = item.request_date ? new Date(item.request_date).getFullYear() : '2026';
            item.request_id = `REQ-${yearStr}-${String(item.id).padStart(3, '0')}`;
        });

        combined.sort((a, b) => new Date(b.request_date) - new Date(a.request_date));

        // Optional "More Filters" sort override: Sort by Employee ID / Employee Name
        // / Department / Request Date, in the requested order.
        const sortFieldMap = {
            'employee_id': 'employee_id',
            'employee_name': 'employee_name',
            'department': 'department',
            'request_date': 'request_date'
        };
        const sortField = sortFieldMap[sort_by];
        if (sortField) {
            const dir = (sort_order === 'desc') ? -1 : 1;
            combined.sort((a, b) => {
                const valA = (a[sortField] || '').toString().toLowerCase();
                const valB = (b[sortField] || '').toString().toLowerCase();
                if (sortField === 'request_date') {
                    return (new Date(a.request_date) - new Date(b.request_date)) * dir;
                }
                return valA.localeCompare(valB) * dir;
            });
        }

        return res.json({ success: true, count: combined.length, data: combined });
    }).catch(err => {
        console.error('Reports Query Error:', err);
        return res.status(500).json({ success: false, message: 'Database error fetching reports.' });
    });
});

// ==========================================================================
// 19b. API ROUTE: GENERATE EXCEL REPORTS (Pending & Approved, per form type)
// Saves into: <REPORTS_BASE_DIR>/<FormType>/Pending-<Month-Year>.xlsx and Approved-<Month-Year>.xlsx
// ==========================================================================
const REPORTS_BASE_DIR = 'C:\\Program Files\\Ampps\\www\\focusinsight_oa\\Focusinsight-reports';

async function writeReportExcel(filePath, formTypeLabel, statusLabel, records) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`${formTypeLabel} - ${statusLabel}`);

    sheet.columns = [
        { header: 'Employee ID', key: 'employee_id', width: 18 },
        { header: 'Name', key: 'name', width: 28 },
        { header: 'Type of Form', key: 'type', width: 22 },
        { header: 'Date', key: 'date', width: 16 }
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFB1E0DB' }
    };

    if (records.length === 0) {
        sheet.addRow({ employee_id: 'No records found.', name: '', type: '', date: '' });
    } else {
        records.forEach(rec => {
            sheet.addRow({
                employee_id: rec.employee_id || '-',
                name: rec.employee_name || '-',
                type: formTypeLabel,
                date: rec.formatted_date || '-'
            });
        });
    }

    await workbook.xlsx.writeFile(filePath);
}

router.post('/api/generate-reports', async (req, res) => {
    try {
        const result = await generateAllReports();
        return res.json({
            success: true,
            message: 'Reports generated successfully!',
            baseFolder: result.baseFolder,
            files: result.files
        });
    } catch (err) {
        console.error('Generate Reports Error:', err);
        const isPermissionError = err.code === 'EPERM' || err.code === 'EACCES';
        return res.status(500).json({
            success: false,
            message: isPermissionError
                ? `Permission denied writing to ${REPORTS_BASE_DIR}. Try running the server as Administrator, or choose a folder outside Program Files.`
                : 'Failed to generate reports: ' + err.message
        });
    }
});

async function generateAllReports() {
    const formQueries = {
        Leave: `SELECT \`Employee ID\` as employee_id, \`Employee Name\` as employee_name, \`Created At\` as request_date, TRIM(Status) as status FROM \`leave\``,
        Loan: `SELECT employee_id, employee_name, created_at as request_date, TRIM(status) as status FROM \`loans\``,
        Disbursement: `SELECT employee_id, employee_name, created_at as request_date, TRIM(status) as status FROM \`disbursements\``,
        Overtime: `SELECT employee_id, employee_name, created_at as request_date, TRIM(status) as status FROM \`overtime\``,
        Travel: `SELECT employee_id, employee_name, created_at as request_date, TRIM(status) as status FROM \`travel\``
    };

    const exec = (sql) => new Promise((resolve, reject) => {
        db.query(sql, (err, results) => err ? reject(err) : resolve(results || []));
    });

    const formTypes = Object.keys(formQueries);
    const allResults = await Promise.all(formTypes.map(type => exec(formQueries[type])));

    const generatedFiles = [];
    const now = new Date();
    const monthLabel = `${now.toLocaleString('en-US', { month: 'short' })}-${now.getFullYear()}`;

    for (let i = 0; i < formTypes.length; i++) {
        const type = formTypes[i];
        const rows = allResults[i];

        rows.forEach(r => {
            let formattedDate = '-';
            if (r.request_date) {
                try {
                    const d = new Date(r.request_date);
                    formattedDate = `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('en-US', { month: 'short' })}-${d.getFullYear()}`;
                } catch (e) {}
            }
            r.formatted_date = formattedDate;
        });

        const pending = rows.filter(r => (r.status || '').toLowerCase() === 'pending');
        const approved = rows.filter(r => (r.status || '').toLowerCase().includes('approve'));

        const typeDir = path.join(REPORTS_BASE_DIR, type);
        fs.mkdirSync(typeDir, { recursive: true });

        const pendingPath = path.join(typeDir, `Pending-${monthLabel}.xlsx`);
        const approvedPath = path.join(typeDir, `Approved-${monthLabel}.xlsx`);

        await writeReportExcel(pendingPath, type, 'Pending', pending);
        await writeReportExcel(approvedPath, type, 'Approved', approved);

        generatedFiles.push(pendingPath, approvedPath);
    }

    return { baseFolder: REPORTS_BASE_DIR, files: generatedFiles };
}

// --------------------------------------------------------------------------
// AUTO-GENERATE MONTHLY REPORTS BY THE 30TH
// Runs a daily check at 9:00 AM (Asia/Kuala_Lumpur). If today is the 30th
// (or the last day of a shorter month, e.g. Feb), it auto-generates reports.
// --------------------------------------------------------------------------
function getMonthlyReportTargetDay(date) {
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return Math.min(30, lastDayOfMonth);
}

function isReportsFolderUpToDateThisMonth() {
    const now = new Date();
    const monthLabel = `${now.toLocaleString('en-US', { month: 'short' })}-${now.getFullYear()}`;
    const marker = path.join(REPORTS_BASE_DIR, 'Leave', `Pending-${monthLabel}.xlsx`);
    return fs.existsSync(marker);
}

cron.schedule('0 9 * * *', async () => {
    const now = new Date();
    if (now.getDate() === getMonthlyReportTargetDay(now)) {
        try {
            await generateAllReports();
            console.log(`[Auto-Report] Monthly reports generated successfully on ${now.toDateString()}.`);
        } catch (err) {
            console.error('[Auto-Report] Failed to auto-generate monthly reports:', err.message);
        }
    }
}, { timezone: 'Asia/Kuala_Lumpur' });

// Catch-up check: if the server was off on the 30th, generate on next startup
// as long as we're still past the target day and haven't generated this month.
(function runStartupCatchUpCheck() {
    const now = new Date();
    const targetDay = getMonthlyReportTargetDay(now);
    if (now.getDate() >= targetDay && !isReportsFolderUpToDateThisMonth()) {
        generateAllReports()
            .then(() => console.log('[Auto-Report] Catch-up: monthly reports generated on startup.'))
            .catch(err => console.error('[Auto-Report] Catch-up generation failed:', err.message));
    }
})();

module.exports = router;