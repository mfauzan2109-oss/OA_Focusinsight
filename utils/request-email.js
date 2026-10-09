'use strict';

// Builds the body of every approval email: greeting, message, a details table
// (form id, staff id, staff name, ...), an optional list and a footer.
// Returns { text, html } so it can be passed straight to sendEmail().

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const OTHER_TYPES = {
    disbursement: { table: 'disbursements', label: 'Disbursement', amountCol: 'total_amount' },
    travel:       { table: 'travel',        label: 'Travel',       amountCol: 'total_amount' },
    overtime:     { table: 'overtime',      label: 'Overtime Claim', amountCol: 'total_claim' },
    loan:         { table: 'loans',         label: 'Loan',         amountCol: 'amount_requested' }
};

// Optional text columns, shown only when the table has them.
const OPTIONAL_FIELDS = [
    ['purpose', 'Purpose'], ['reason', 'Reason'], ['description', 'Description'],
    ['destination', 'Destination'], ['remarks', 'Remarks']
];

function esc(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toDate(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(v);
    return isNaN(d) ? null : d;
}

function fmtDate(v) {
    const d = toDate(v);
    if (!d) return '-';
    return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function titleCase(s) {
    return String(s || '').replace(/[_-]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}

function leaveTypeLabel(s) {
    const t = titleCase(s);
    return /leave$/i.test(t) ? t : `${t} Leave`;
}

function fmtDuration(n) {
    const v = parseFloat(n);
    return isNaN(v) ? '-' : v.toFixed(1);
}

async function loadDetails(connection, typeKey, id) {
    const ref = `REQ-${typeKey.toUpperCase()}-${id}`;

    if (typeKey === 'leave') {
        const [rows] = await connection.query('SELECT * FROM `leave` WHERE ID = ?', [id]);
        const row = rows && rows[0];
        if (!row) return null;

        const [entryRows] = await connection.query(
            'SELECT start_date, end_date, day_type, duration FROM leave_date_entries WHERE leave_id = ? ORDER BY entry_order',
            [id]
        ).catch(() => [[]]);

        let entries = (entryRows || []).map(e => ({
            start: fmtDate(e.start_date), end: fmtDate(e.end_date),
            dayType: titleCase(e.day_type), duration: fmtDuration(e.duration)
        }));
        if (!entries.length) {
            entries = [{
                start: fmtDate(row['Start Date']), end: fmtDate(row['End Date']),
                dayType: titleCase(row['Day type'] || row['Day Type']), duration: fmtDuration(row['No of Days'])
            }];
        }

        return {
            ref,
            staffId: row['Employee ID'], staffName: row['Employee Name'], department: row['Department'],
            leave: {
                type: leaveTypeLabel(row['Leave Type']),
                entries,
                total: fmtDuration(row['No of Days']),
                reason: row['Reason'] || '-'
            },
            extra: []
        };
    }

    const cfg = OTHER_TYPES[typeKey];
    if (!cfg) return null;
    const [rows] = await connection.query(`SELECT * FROM \`${cfg.table}\` WHERE id = ?`, [id]);
    const row = rows && rows[0];
    if (!row) return null;

    const extra = [['Request Type', cfg.label]];
    if (row[cfg.amountCol] != null) {
        extra.push(['Amount', `RM ${parseFloat(row[cfg.amountCol] || 0).toFixed(2)}`]);
    }
    OPTIONAL_FIELDS.forEach(([col, label]) => {
        if (row[col]) extra.push([label, row[col]]);
    });
    if (row.created_at) extra.push(['Submitted', fmtDate(row.created_at)]);

    return {
        ref,
        staffId: row.employee_id, staffName: row.employee_name, department: row.department,
        leave: null,
        extra
    };
}

const TH = 'padding:8px 10px;background:#d9f4e8;color:#2563eb;font-size:12px;text-transform:uppercase;border:1px solid #bfe3d3;text-align:center;';
const TD = 'padding:10px;border:1px solid #d6e4df;font-size:14px;color:#111827;text-align:center;';
const LABEL = 'padding:10px;border:1px solid #d6e4df;font-size:13px;font-weight:bold;color:#374151;background:#f9fafb;text-align:left;width:35%;';

function detailsHtml(d) {
    let h = `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:14px 0;">
        <tr><th style="${TH}">Form ID</th><th style="${TH}">Staff ID</th><th style="${TH}">Staff Name</th><th style="${TH}">Department</th></tr>
        <tr><td style="${TD}">${esc(d.ref)}</td><td style="${TD}">${esc(d.staffId)}</td><td style="${TD}">${esc(d.staffName)}</td><td style="${TD}">${esc(d.department)}</td></tr>
    </table>`;

    if (d.leave) {
        const L = d.leave;
        h += `<p style="margin:14px 0 4px;font-size:13px;font-weight:bold;color:#374151;">Leave Type</p>
        <div style="padding:10px;border:1px solid #d6e4df;background:#f9fafb;font-size:14px;">${esc(L.type)}</div>
        <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:14px 0;">
            <tr><th style="${TH}">Start Date</th><th style="${TH}">End Date</th><th style="${TH}">Day Type</th><th style="${TH}">Duration</th></tr>
            ${L.entries.map(e => `<tr><td style="${TD}">${esc(e.start)}</td><td style="${TD}">${esc(e.end)}</td><td style="${TD}">${esc(e.dayType)}</td><td style="${TD}">${esc(e.duration)}</td></tr>`).join('')}
            <tr><td colspan="2" style="border:1px solid #d6e4df;"></td><td style="${TD}font-weight:bold;">Total Days</td><td style="${TD}font-weight:bold;">${esc(L.total)}</td></tr>
        </table>
        <p style="margin:14px 0 4px;font-size:13px;font-weight:bold;color:#374151;">Reason / Description</p>
        <div style="padding:10px;border:1px solid #d6e4df;background:#f9fafb;font-size:14px;white-space:pre-wrap;">${esc(L.reason)}</div>`;
    } else if (d.extra.length) {
        h += `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:14px 0;">
            ${d.extra.map(([k, v]) => `<tr><td style="${LABEL}">${esc(k)}</td><td style="${TD}text-align:left;">${esc(v)}</td></tr>`).join('')}
        </table>`;
    }
    return h;
}

function detailsText(d) {
    const lines = [
        `Form ID    : ${d.ref}`,
        `Staff ID   : ${d.staffId}`,
        `Staff Name : ${d.staffName}`,
        `Department : ${d.department}`
    ];
    if (d.leave) {
        const L = d.leave;
        lines.push(`Leave Type : ${L.type}`);
        L.entries.forEach((e, i) => lines.push(`Date ${i + 1}     : ${e.start} to ${e.end} (${e.dayType}, ${e.duration} day(s))`));
        lines.push(`Total Days : ${L.total}`);
        lines.push(`Reason     : ${L.reason}`);
    } else {
        d.extra.forEach(([k, v]) => lines.push(`${k.padEnd(10)} : ${v}`));
    }
    return lines.join('\n');
}

// options: { greeting, paragraphs: [], listTitle, listItems: [], footer }
async function buildEmail(connection, typeKey, id, options) {
    const o = options || {};
    const paragraphs = o.paragraphs || [];
    const listItems = o.listItems || [];

    let details = null;
    try {
        details = await loadDetails(connection, typeKey, id);
    } catch (e) {
        console.error('[EMAIL] Could not load request details:', e.message);
    }

    const text =
        (o.greeting ? `${o.greeting}\n\n` : '') +
        paragraphs.join('\n') + '\n' +
        (details ? `\n${detailsText(details)}\n` : '') +
        (listItems.length ? `\n${o.listTitle || ''}\n${listItems.map(i => `  - ${i}`).join('\n')}\n` : '') +
        (o.footer ? `\n${o.footer}` : '');

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;color:#111827;">
        ${o.greeting ? `<p style="font-size:14px;">${esc(o.greeting)}</p>` : ''}
        ${paragraphs.map(p => `<p style="font-size:14px;margin:6px 0;">${esc(p)}</p>`).join('')}
        ${details ? detailsHtml(details) : ''}
        ${listItems.length ? `<p style="font-size:13px;font-weight:bold;margin:14px 0 4px;">${esc(o.listTitle || '')}</p>
            <ul style="font-size:14px;margin:0;padding-left:20px;">${listItems.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
        ${o.footer ? `<p style="font-size:13px;color:#6b7280;margin-top:18px;">${esc(o.footer)}</p>` : ''}
    </div>`;

    return { text, html };
}

module.exports = { buildEmail, loadDetails };