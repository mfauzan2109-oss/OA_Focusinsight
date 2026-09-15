const express = require('express');

const router = express.Router();

router.use(require('./dashboard.routes'));
router.use(require('./auth.routes'));
router.use(require('./leave.routes'));
router.use(require('./request.routes'));
router.use(require('./approval.routes'));
router.use(require('./hr.routes'));
router.use(require('./users.routes'));
router.use(require('./reports.routes'));
router.use(require('./reminder.routes'));
router.use(require('./workflow.routes'));
router.use(require('./printing-production'));
router.use(require('./legacy-forms.routes'));

module.exports = router;
