const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Matches the pattern confirmed in routes/requests.js — config/db.js
// exports a callback-style connection/pool used as db.query(sql, params, cb)
const db = require('../config/db');

// ==========================================================================
// FILE UPLOAD CONFIG (multer) — saves into /uploads, same folder the rest
// of the app serves statically via app.use('/uploads', express.static(...))
// ==========================================================================
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
        cb(null, uniqueSuffix);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB, matches the form's stated limit
    fileFilter: (req, file, cb) => {
        const allowed = /pdf|jpg|jpeg|png/;
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.test(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, JPG, and PNG files are allowed.'));
        }
    }
});

// The form sends up to three files: artwork_attachment (always required,
// Request Details section), oth_reference_attachment (Other type only),
// and quotation_attachment (Delivery & Cost section)
const cpUpload = upload.fields([
    { name: 'artwork_attachment', maxCount: 1 },
    { name: 'oth_reference_attachment', maxCount: 1 },
    { name: 'quotation_attachment', maxCount: 1 }
]);

// ==========================================================================
// POST /api/submit-printing-production-request
// ==========================================================================
router.post('/api/submit-printing-production-request', (req, res) => {
    cpUpload(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        const b = req.body;

        // Basic required-field guard (mirrors the client-side validation)
        if (!b.request_type || !b.quantity || !b.required_size || !b.material_specification ||
            !b.content_title || !b.required_completion_date || !b.delivery_location ||
            !b.estimated_cost || !b.purpose) {
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }
        if (!req.files || !req.files['artwork_attachment']) {
            return res.status(400).json({ success: false, message: 'Design / Artwork Attachment is required.' });
        }

        const artworkPath = `uploads/${req.files['artwork_attachment'][0].filename}`;
        const othReferencePath = req.files['oth_reference_attachment']
            ? `uploads/${req.files['oth_reference_attachment'][0].filename}`
            : null;
        const quotationPath = req.files['quotation_attachment']
            ? `uploads/${req.files['quotation_attachment'][0].filename}`
            : null;

        const sql = `
            INSERT INTO printing_production_requests (
                employee_id, name, position, department, request_date,
                request_type, please_specify,
                quantity, required_size, material_specification, content_title, artwork_attachment_path,
                bc_name, bc_position, bc_department, bc_email, bc_phone, bc_no_of_cards,
                bp_width, bp_height, bp_material, bp_installation_required, bp_installation_location,
                pb_document_title, pb_no_of_copies, pb_page_count, pb_paper, pb_cover, pb_binding_specification,
                oth_item_name, oth_quantity, oth_unit, oth_required_size, oth_material, oth_specification, oth_reference_attachment_path,
                required_completion_date, delivery_location, estimated_cost, vendor_supplier, quotation_attachment_path,
                purpose, remarks, status
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?
            )
        `;

        const values = [
            b.employee_id, b.name, b.position || null, b.department || null, b.request_date || null,
            b.request_type, b.please_specify || null,

            b.quantity, b.required_size, b.material_specification, b.content_title, artworkPath,

            b.bc_name || null, b.bc_position || null, b.bc_department || null, b.bc_email || null, b.bc_phone || null, b.bc_no_of_cards || null,

            b.bp_width || null, b.bp_height || null, b.bp_material || null, b.bp_installation_required || null, b.bp_installation_location || null,

            b.pb_document_title || null, b.pb_no_of_copies || null, b.pb_page_count || null, b.pb_paper || null, b.pb_cover || null, b.pb_binding_specification || null,

            b.oth_item_name || null, b.oth_quantity || null, b.oth_unit || null, b.oth_required_size || null, b.oth_material || null, b.oth_specification || null, othReferencePath,

            b.required_completion_date, b.delivery_location, b.estimated_cost, b.vendor_supplier || null, quotationPath,

            b.purpose, b.remarks || null, 'Pending'
        ];

        db.query(sql, values, (dbErr, result) => {
            if (dbErr) {
                console.error('Error submitting printing & production request:', dbErr);
                return res.status(500).json({ success: false, message: 'Server error while submitting request.' });
            }

            return res.json({
                success: true,
                message: 'Printing & Production Request submitted successfully.',
                id: result.insertId
            });
        });
    });
});

// ==========================================================================
// GET /api/printing-production-requests — list all (for My Request / HR views)
// ==========================================================================
router.get('/api/printing-production-requests', (req, res) => {
    const { employee_id } = req.query;

    let sql = 'SELECT * FROM printing_production_requests';
    const params = [];

    if (employee_id) {
        sql += ' WHERE employee_id = ?';
        params.push(employee_id);
    }
    sql += ' ORDER BY created_at DESC';

    db.query(sql, params, (dbErr, rows) => {
        if (dbErr) {
            console.error('Error fetching printing & production requests:', dbErr);
            return res.status(500).json({ success: false, message: 'Server error while fetching requests.' });
        }
        return res.json({ success: true, data: rows });
    });
});

// ==========================================================================
// PATCH /api/printing-production-requests/:id/status — approve/reject/etc.
// ==========================================================================
router.patch('/api/printing-production-requests/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    db.query(
        'UPDATE printing_production_requests SET status = ? WHERE id = ?',
        [status, id],
        (dbErr) => {
            if (dbErr) {
                console.error('Error updating printing & production request status:', dbErr);
                return res.status(500).json({ success: false, message: 'Server error while updating status.' });
            }
            return res.json({ success: true, message: 'Status updated successfully.' });
        }
    );
});

module.exports = router;