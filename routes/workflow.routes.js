const express = require('express');

const db = require('../config/database');

const router = express.Router();

router.get('/api/workflows', (req, res) => {
    const query = `SELECT workflow_type, workflow_name, step_order, step_label, approver_role FROM workflows ORDER BY workflow_type, step_order ASC`;

    db.query(query, (err, rows) => {
        if (err) {
            console.error('Fetch Workflows Error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }

        const grouped = {};
        (rows || []).forEach(row => {
            if (!grouped[row.workflow_type]) {
                grouped[row.workflow_type] = {
                    workflow_type: row.workflow_type,
                    workflow_name: row.workflow_name,
                    steps: []
                };
            }
            grouped[row.workflow_type].steps.push(row.approver_role);
        });

        const result = Object.values(grouped).map(wf => ({
            workflow_type: wf.workflow_type,
            workflow_name: wf.workflow_name,
            chain: wf.steps.join(' → '),
            levels: wf.steps.length
        }));

        return res.json({ success: true, data: result });
    });
});

router.get('/api/workflows/:type', (req, res) => {
    const workflowType = (req.params.type || '').trim().toLowerCase();

    const query = `SELECT id, workflow_name, step_order, step_label, approver_role FROM workflows WHERE LOWER(workflow_type) = LOWER(?) ORDER BY step_order ASC`;

    db.query(query, [workflowType], (err, rows) => {
        if (err) {
            console.error('Fetch Workflow Detail Error:', err);
            return res.status(500).json({ success: false, message: 'Database error: ' + err.message });
        }

        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: `Workflow type '${workflowType}' not found.` });
        }

        return res.json({
            success: true,
            workflow_type: workflowType,
            workflow_name: rows[0].workflow_name,
            steps: rows.map(r => ({ label: r.step_label, value: r.approver_role }))
        });
    });
});

router.post('/api/workflows', (req, res) => {
    const { workflow_type, workflow_name, steps } = req.body;

    if (!workflow_type || !workflow_name || !Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ success: false, message: 'Workflow type, name, and at least one step are required.' });
    }

    const cleanType = workflow_type.trim().toLowerCase().replace(/\s+/g, '-');

    const checkQuery = `SELECT id FROM workflows WHERE LOWER(workflow_type) = LOWER(?) LIMIT 1`;
    db.query(checkQuery, [cleanType], (checkErr, checkResults) => {
        if (checkErr) {
            console.error('Check Workflow Error:', checkErr);
            return res.status(500).json({ success: false, message: 'Database error: ' + checkErr.message });
        }

        if (checkResults.length > 0) {
            return res.status(409).json({ success: false, message: `A workflow with type '${cleanType}' already exists.` });
        }

        const insertQuery = `INSERT INTO workflows (workflow_type, workflow_name, step_order, step_label, approver_role) VALUES ?`;
        const values = steps.map((step, index) => [
            cleanType,
            workflow_name.trim(),
            index + 1,
            step.label || `Approver Step ${index + 1}`,
            step.value || 'Employee'
        ]);

        db.query(insertQuery, [values], (insErr) => {
            if (insErr) {
                console.error('Insert New Workflow Error:', insErr);
                return res.status(500).json({ success: false, message: 'Database error: ' + insErr.message });
            }
            return res.json({ success: true, message: 'New workflow created successfully!', workflow_type: cleanType });
        });
    });
});

router.put('/api/workflows/:type', (req, res) => {
    const workflowType = (req.params.type || '').trim().toLowerCase();
    const { workflow_name, steps } = req.body;

    if (!workflowType || !Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ success: false, message: 'Workflow type and at least one step are required.' });
    }

    const deleteQuery = `DELETE FROM workflows WHERE LOWER(workflow_type) = LOWER(?)`;

    db.query(deleteQuery, [workflowType], (delErr) => {
        if (delErr) {
            console.error('Delete Old Workflow Steps Error:', delErr);
            return res.status(500).json({ success: false, message: 'Database error: ' + delErr.message });
        }

        const insertQuery = `INSERT INTO workflows (workflow_type, workflow_name, step_order, step_label, approver_role) VALUES ?`;
        const values = steps.map((step, index) => [
            workflowType,
            workflow_name || workflowType,
            index + 1,
            step.label || `Approver Step ${index + 1}`,
            step.value || 'Employee'
        ]);

        db.query(insertQuery, [values], (insErr) => {
            if (insErr) {
                console.error('Insert New Workflow Steps Error:', insErr);
                return res.status(500).json({ success: false, message: 'Database error: ' + insErr.message });
            }
            return res.json({ success: true, message: 'Workflow updated successfully!' });
        });
    });
});

module.exports = router;
