const express = require('express');

const router = express.Router();

router.use(require('./dashboard.routes'));
router.use(require('./auth.routes'));

// P1 form routes
router.use(require('./leave.routes'));
router.use(require('./probation.routes'));

// P1 submission APIs
router.use(require('./p1-request.routes'));

// Main branch reports / existing APIs
router.use(require('./request.routes'));

// P1 notifications + approval MUST be before legacy approval
router.use(require('./resignation-notifications.routes'));
router.use(require('./resignation-approval.routes'));

// Legacy fallback
router.use(require('./approval.routes'));

router.use(require('./hr.routes'));
router.use(require('./users.routes'));
router.use(require('./reports.routes'));
router.use(require('./reminder.routes'));
router.use(require('./workflow.routes'));

// Preserve frontend team's latest features
router.use(require('./printing-production'));
router.use(require('./legacy-forms.routes'));

module.exports = router;