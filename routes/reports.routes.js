const express = require('express');

const db = require('../config/database');

const router = express.Router();

router.get('/api/reports', (req, res) => {
    const { request_type, department, date_from, date_to } = req.query;

    let leaveQuery  = `SELECT l.ID as id, 'Leave Application' as request_type, l.\`Employee Name\` as employee_name, l.\`Employee ID\` as employee_id, l.Department as department, l.\`Created At\` as request_date FROM \`leave\` l WHERE 1=1`;
    let disQuery    = `SELECT d.id, 'Disbursement Form' as request_type, d.employee_name, d.employee_id, d.department, d.created_at as request_date FROM \`disbursements\` d WHERE 1=1`;
    let travelQuery = `SELECT t.id, 'Travel Request' as request_type, t.employee_name, t.employee_id, t.department, t.created_at as request_date FROM \`travel\` t WHERE 1=1`;
    let otQuery     = `SELECT o.id, 'Overtime Claim' as request_type, o.employee_name, o.employee_id, o.department, o.created_at as request_date FROM \`overtime\` o WHERE 1=1`;
    let loanQuery   = `SELECT ln.id, 'Loan Application' as request_type, ln.employee_name, ln.employee_id, ln.department, ln.created_at as request_date FROM \`loans\` ln WHERE 1=1`;

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

        return res.json({ success: true, count: combined.length, data: combined });
    }).catch(err => {
        console.error('Reports Query Error:', err);
        return res.status(500).json({ success: false, message: 'Database error fetching reports.' });
    });
});

module.exports = router;
