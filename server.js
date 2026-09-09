const express = require('express');
const path = require('path');
const cors = require('cors');

// Establishes the MySQL connection on require (see config/db.js)
require('./config/db');

const app = express();
const port = 3000;

// ==========================================================================
// MIDDLEWARE & STATIC FILE ROUTING
// ==========================================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

app.get('/dashboard-manager.html', (req, res) => {
    res.redirect('/dashboard.html');
});

// ==========================================================================
// ROUTE MODULES
// ==========================================================================
app.use(require('./routes/auth'));
app.use(require('./routes/hr'));
app.use(require('./routes/notifications'));
app.use(require('./routes/employee'));
app.use(require('./routes/leave'));
app.use(require('./routes/disbursements'));
app.use(require('./routes/travel'));
app.use(require('./routes/overtime'));
app.use(require('./routes/loans'));
app.use(require('./routes/salary'));
app.use(require('./routes/probation'));
app.use(require('./routes/resignation'));
app.use(require('./routes/recruitment'));
app.use(require('./routes/manpower'));
app.use(require('./routes/india-visa'));
app.use(require('./routes/printing-production'));
app.use(require('./routes/requests'));
app.use(require('./routes/users'));
app.use(require('./routes/reports'));
app.use(require('./routes/departments'));
app.use(require('./routes/workflows'));

app.listen(port, () => {
    console.log(`Node Server running seamlessly on: http://localhost:3000`);
});