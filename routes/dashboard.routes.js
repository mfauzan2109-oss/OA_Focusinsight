const express = require('express');

const router = express.Router();

router.get('/dashboard-manager.html', (req, res) => {
    res.redirect('/dashboard.html');
});

module.exports = router;
