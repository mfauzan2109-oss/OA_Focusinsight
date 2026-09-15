const express = require('express');
const cors = require('cors');
const path = require('path');

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Global middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Block direct HTTP access to backend internals and legacy files before
// falling through to the whole-project static server below. `express.static
// (__dirname)` otherwise serves anything under the project root as a
// downloadable file — including route/middleware source, DB config, and the
// legacy PHP scripts that still contain a hardcoded database password.
const BLOCKED_PREFIXES = ['/node_modules', '/routes', '/middleware', '/config', '/utils'];
const BLOCKED_FILES = [
    '/server.js',
    '/package.json',
    '/package-lock.json',
    '/README_REFACTOR.md',
    '/db_connect.php',
    '/submit_leave.php'
];

app.use((req, res, next) => {
    const urlPath = req.path;

    if (urlPath.endsWith('.php')) {
        return res.status(404).end();
    }
    if (BLOCKED_FILES.includes(urlPath)) {
        return res.status(404).end();
    }
    if (BLOCKED_PREFIXES.some(prefix => urlPath === prefix || urlPath.startsWith(`${prefix}/`))) {
        return res.status(404).end();
    }

    next();
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

// API and application routes
app.use(routes);

// Centralized error handler — e.g. multer file-type/size rejections —
// so API callers always get JSON back instead of Express's HTML error page.
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }
    console.error('Unhandled error:', err);
    const status = err.status || 400;
    res.status(status).json({
        success: false,
        message: err.message || 'An unexpected error occurred.'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Node Server running on: http://localhost:${PORT}`);
});
